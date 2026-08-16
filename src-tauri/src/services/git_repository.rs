//! Read-only Git inspection for the active session repository.

use std::path::{Component, Path, PathBuf};
use std::process::{Command, Output};

use anyhow::{anyhow, bail, Context, Result};

use crate::models::{GitChangesSnapshot, GitFileChange};

const MAX_DIFF_BYTES: usize = 4 * 1024 * 1024;

/// Return staged, unstaged, and untracked files for the repository containing `cwd`.
pub fn get_changes(cwd: &Path) -> Result<GitChangesSnapshot> {
    let root = repository_root(cwd)?;
    let status = git(
        &root,
        &["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    )?;
    let mut files = parse_porcelain(&status.stdout)?;
    files.sort_by(|a, b| b.staged.cmp(&a.staged).then_with(|| a.path.cmp(&b.path)));

    Ok(GitChangesSnapshot {
        root: root.to_string_lossy().into_owned(),
        branch: branch_name(&root)?,
        files,
    })
}

/// Return a unified patch for one changed file.
pub fn get_file_diff(cwd: &Path, path: &str, staged: bool, untracked: bool) -> Result<String> {
    validate_relative_path(path)?;
    let root = repository_root(cwd)?;

    let output = if untracked {
        git_allowing_diff_exit(
            &root,
            &[
                "--literal-pathspecs",
                "diff",
                "--no-index",
                "--no-ext-diff",
                "--no-textconv",
                "--unified=3",
                "--",
                "/dev/null",
                path,
            ],
        )?
    } else if staged {
        git(
            &root,
            &[
                "--literal-pathspecs",
                "diff",
                "--cached",
                "--no-ext-diff",
                "--no-textconv",
                "--unified=3",
                "--",
                path,
            ],
        )?
    } else {
        git(
            &root,
            &[
                "--literal-pathspecs",
                "diff",
                "--no-ext-diff",
                "--no-textconv",
                "--unified=3",
                "--",
                path,
            ],
        )?
    };

    if output.stdout.len() > MAX_DIFF_BYTES {
        bail!("Diff exceeds the 4 MiB display limit");
    }

    String::from_utf8(output.stdout).context("Git diff output was not valid UTF-8")
}

fn repository_root(cwd: &Path) -> Result<PathBuf> {
    if !cwd.is_dir() {
        bail!("Session working directory does not exist");
    }
    let output =
        git(cwd, &["rev-parse", "--show-toplevel"]).map_err(|_| anyhow!("Not a Git repository"))?;
    let value = String::from_utf8(output.stdout).context("Repository path was not valid UTF-8")?;
    Ok(PathBuf::from(value.trim()))
}

fn branch_name(root: &Path) -> Result<String> {
    if let Ok(output) = git(root, &["symbolic-ref", "--quiet", "--short", "HEAD"]) {
        return Ok(String::from_utf8_lossy(&output.stdout).trim().to_owned());
    }
    let output = git(root, &["rev-parse", "--short", "HEAD"])?;
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_owned())
}

fn validate_relative_path(value: &str) -> Result<()> {
    let path = Path::new(value);
    if value.is_empty()
        || path.is_absolute()
        || path
            .components()
            .any(|part| !matches!(part, Component::Normal(_)))
    {
        bail!("Invalid repository-relative file path");
    }
    Ok(())
}

fn git(cwd: &Path, args: &[&str]) -> Result<Output> {
    let output = safe_command(cwd, args)
        .output()
        .with_context(|| format!("Failed to run git in {}", cwd.display()))?;
    if output.status.success() {
        Ok(output)
    } else {
        Err(git_error(output))
    }
}

fn git_allowing_diff_exit(cwd: &Path, args: &[&str]) -> Result<Output> {
    let output = safe_command(cwd, args)
        .output()
        .with_context(|| format!("Failed to run git in {}", cwd.display()))?;
    if output.status.success() || output.status.code() == Some(1) {
        Ok(output)
    } else {
        Err(git_error(output))
    }
}

pub(crate) fn safe_command(cwd: &Path, args: &[&str]) -> Command {
    let mut command = Command::new("/usr/bin/git");
    command
        .env_clear()
        .env("HOME", "/var/empty")
        .env("LANG", "en_US.UTF-8")
        .env("PATH", "/usr/bin:/bin")
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .args([
            "-c",
            "core.fsmonitor=false",
            "-c",
            "core.hooksPath=/dev/null",
            "-c",
            "diff.external=",
        ])
        .args(args)
        .current_dir(cwd);
    command
}

fn git_error(output: Output) -> anyhow::Error {
    let message = String::from_utf8_lossy(&output.stderr);
    anyhow!(message.trim().to_owned())
}

fn parse_porcelain(bytes: &[u8]) -> Result<Vec<GitFileChange>> {
    let fields: Vec<&[u8]> = bytes
        .split(|byte| *byte == 0)
        .filter(|field| !field.is_empty())
        .collect();
    let mut files = Vec::new();
    let mut index = 0;

    while index < fields.len() {
        let entry = fields[index];
        if entry.len() < 4 || entry[2] != b' ' {
            bail!("Unexpected git status output");
        }

        let index_status = entry[0] as char;
        let worktree_status = entry[1] as char;
        let path =
            String::from_utf8(entry[3..].to_vec()).context("Git path was not valid UTF-8")?;
        let renamed = matches!(index_status, 'R' | 'C') || matches!(worktree_status, 'R' | 'C');
        let old_path = if renamed {
            index += 1;
            let value = fields
                .get(index)
                .ok_or_else(|| anyhow!("Missing original rename path"))?;
            Some(String::from_utf8(value.to_vec()).context("Git rename path was not valid UTF-8")?)
        } else {
            None
        };

        if index_status == '?' && worktree_status == '?' {
            files.push(GitFileChange {
                path,
                old_path: None,
                status: "?".into(),
                staged: false,
                untracked: true,
            });
        } else {
            if index_status != ' ' {
                files.push(GitFileChange {
                    path: path.clone(),
                    old_path: old_path.clone(),
                    status: index_status.to_string(),
                    staged: true,
                    untracked: false,
                });
            }
            if worktree_status != ' ' {
                files.push(GitFileChange {
                    path,
                    old_path,
                    status: worktree_status.to_string(),
                    staged: false,
                    untracked: false,
                });
            }
        }
        index += 1;
    }

    Ok(files)
}

#[cfg(test)]
mod tests {
    use super::{get_changes, get_file_diff, parse_porcelain, safe_command};
    #[cfg(unix)]
    use std::{fs, os::unix::fs::PermissionsExt, process::Command};

    #[test]
    fn parses_staged_unstaged_untracked_and_rename_entries() {
        let input = b"M  staged.ts\0 M unstaged.ts\0?? new.ts\0R  current.ts\0old.ts\0MM both.ts\0";
        let files = parse_porcelain(input).unwrap();

        assert_eq!(files.len(), 6);
        assert!(files
            .iter()
            .any(|file| file.path == "staged.ts" && file.staged));
        assert!(files
            .iter()
            .any(|file| file.path == "unstaged.ts" && !file.staged));
        assert!(files
            .iter()
            .any(|file| file.path == "new.ts" && file.untracked));
        assert!(files.iter().any(|file| {
            file.path == "current.ts" && file.old_path.as_deref() == Some("old.ts")
        }));
        assert_eq!(
            files.iter().filter(|file| file.path == "both.ts").count(),
            2
        );
    }

    #[cfg(unix)]
    #[test]
    fn repository_config_cannot_execute_programs() {
        let root = std::env::temp_dir().join(format!("piarc-hostile-git-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        assert!(Command::new("/usr/bin/git")
            .args(["init", "--quiet"])
            .current_dir(&root)
            .status()
            .unwrap()
            .success());

        let marker = root.join("executed");
        let hook = root.join("hostile-hook");
        fs::write(&hook, format!("#!/bin/sh\ntouch '{}'\n", marker.display())).unwrap();
        fs::set_permissions(&hook, fs::Permissions::from_mode(0o755)).unwrap();
        fs::write(
            root.join(".git/config"),
            format!(
                "[core]\n\trepositoryformatversion = 0\n\tbare = false\n\tfsmonitor = {}\n[diff \"hostile\"]\n\ttextconv = {}\n",
                hook.display(),
                hook.display()
            ),
        )
        .unwrap();
        fs::write(root.join(".gitattributes"), "*.txt diff=hostile\n").unwrap();
        fs::write(root.join("sample.txt"), "before\n").unwrap();
        assert!(
            safe_command(&root, &["add", ".gitattributes", "sample.txt"])
                .status()
                .unwrap()
                .success()
        );
        fs::write(root.join("sample.txt"), "after\n").unwrap();

        get_changes(&root).unwrap();
        let diff = get_file_diff(&root, "sample.txt", false, false).unwrap();
        assert!(diff.contains("-before"));
        assert!(diff.contains("+after"));
        assert!(!marker.exists());

        fs::remove_dir_all(root).unwrap();
    }
}
