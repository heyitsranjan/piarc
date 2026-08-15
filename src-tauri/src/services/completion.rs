//! Dynamic OMP command and workspace-path completion.

use std::collections::BTreeMap;
use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::process::{Command, Stdio};

use anyhow::{anyhow, bail, Context, Result};
use serde_json::Value;

use crate::models::{OmpCommand, OmpPathSuggestion};

const MAX_RESULTS: usize = 100;
const MAX_WALK_ENTRIES: usize = 50_000;
const MAX_WORKSPACE_ENTRIES: usize = 50_000;
const MAX_FILE_BYTES: u64 = 2 * 1024 * 1024;

/// Ask the installed OMP binary for its effective built-in, plugin, skill, and file commands.
pub fn list_commands(cwd: &Path) -> Result<Vec<OmpCommand>> {
    ensure_directory(cwd)?;
    let mut child = Command::new("omp")
        .args(["--mode", "rpc", "--no-session", "--cwd"])
        .arg(cwd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .context("Failed to start omp for command discovery")?;

    let mut stdin = child.stdin.take().context("Failed to open omp stdin")?;
    stdin
        .write_all(b"{\"id\":\"commands\",\"type\":\"get_available_commands\"}\n")
        .context("Failed to request omp commands")?;
    drop(stdin);

    let output = child
        .wait_with_output()
        .context("Failed while waiting for omp command discovery")?;
    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        bail!(if error.is_empty() {
            "omp command discovery failed".to_owned()
        } else {
            error
        });
    }

    for line in output.stdout.split(|byte| *byte == b'\n') {
        let Ok(frame) = serde_json::from_slice::<Value>(line) else {
            continue;
        };
        if frame.get("type").and_then(Value::as_str) != Some("response")
            || frame.get("command").and_then(Value::as_str) != Some("get_available_commands")
            || frame.get("success").and_then(Value::as_bool) != Some(true)
        {
            continue;
        }
        let commands = frame
            .get("data")
            .and_then(|data| data.get("commands"))
            .cloned()
            .context("OMP command response did not contain commands")?;
        return serde_json::from_value(commands).context("OMP returned invalid command metadata");
    }

    Err(anyhow!("OMP did not return command metadata"))
}

/// Return OMP-style fuzzy file and directory suggestions rooted at `cwd`.
pub fn list_paths(cwd: &Path, query: &str) -> Result<Vec<OmpPathSuggestion>> {
    ensure_directory(cwd)?;
    let query = query.trim_start_matches('"');
    if query.is_empty() {
        return list_directory(cwd, "");
    }

    let entries = git_entries(cwd).unwrap_or_else(|| walk_entries(cwd));
    let lower_query = query.to_lowercase();
    let mut ranked: Vec<(i32, String, bool)> = entries
        .into_iter()
        .filter_map(|(path, is_directory)| {
            fuzzy_score(&lower_query, &path.to_lowercase())
                .map(|score| (score + i32::from(is_directory), path, is_directory))
        })
        .collect();
    ranked.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.1.cmp(&b.1)));
    ranked.truncate(MAX_RESULTS);

    Ok(ranked
        .into_iter()
        .map(|(_, path, is_directory)| OmpPathSuggestion { path, is_directory })
        .collect())
}

/// Return the project file tree, preferring Git's ignore-aware index.
pub fn list_workspace_entries(cwd: &Path) -> Result<Vec<OmpPathSuggestion>> {
    ensure_directory(cwd)?;
    let entries = git_entries(cwd).unwrap_or_else(|| walk_entries(cwd));
    Ok(entries
        .into_iter()
        .take(MAX_WORKSPACE_ENTRIES)
        .map(|(path, is_directory)| OmpPathSuggestion { path, is_directory })
        .collect())
}

/// Read one UTF-8 project file without allowing paths to escape the workspace.
pub fn read_workspace_file(cwd: &Path, relative: &str) -> Result<String> {
    ensure_directory(cwd)?;
    validate_relative_path(relative)?;

    let root = cwd
        .canonicalize()
        .with_context(|| format!("Failed to resolve {}", cwd.display()))?;
    let file = root
        .join(relative)
        .canonicalize()
        .with_context(|| format!("Failed to resolve {relative}"))?;
    if !file.starts_with(&root) || !file.is_file() {
        bail!("File is outside the workspace or no longer exists");
    }

    let size = file
        .metadata()
        .with_context(|| format!("Failed to inspect {relative}"))?
        .len();
    if size > MAX_FILE_BYTES {
        bail!("File exceeds the 2 MiB display limit");
    }

    let bytes = fs::read(&file).with_context(|| format!("Failed to read {relative}"))?;
    if bytes.contains(&0) {
        bail!("Binary files cannot be displayed");
    }
    String::from_utf8(bytes).context("File is not valid UTF-8")
}

fn validate_relative_path(value: &str) -> Result<()> {
    let path = Path::new(value);
    if value.is_empty()
        || path.is_absolute()
        || path
            .components()
            .any(|part| !matches!(part, Component::Normal(_)))
    {
        bail!("Invalid workspace-relative file path");
    }
    Ok(())
}

fn ensure_directory(path: &Path) -> Result<()> {
    if path.is_dir() {
        Ok(())
    } else {
        bail!("Session working directory does not exist")
    }
}

fn list_directory(directory: &Path, display_prefix: &str) -> Result<Vec<OmpPathSuggestion>> {
    let mut suggestions = Vec::new();
    for entry in fs::read_dir(directory)
        .with_context(|| format!("Failed to read {}", directory.display()))?
    {
        let entry = match entry {
            Ok(value) => value,
            Err(_) => continue,
        };
        let name = entry.file_name().to_string_lossy().into_owned();
        if name == ".git" {
            continue;
        }
        let is_directory = entry.file_type().map(|kind| kind.is_dir()).unwrap_or(false);
        suggestions.push(OmpPathSuggestion {
            path: format!("{display_prefix}{name}"),
            is_directory,
        });
    }
    suggestions.sort_by(|a, b| {
        b.is_directory
            .cmp(&a.is_directory)
            .then_with(|| a.path.to_lowercase().cmp(&b.path.to_lowercase()))
    });
    suggestions.truncate(MAX_RESULTS);
    Ok(suggestions)
}

fn git_entries(cwd: &Path) -> Option<BTreeMap<String, bool>> {
    let output = Command::new("git")
        .args(["ls-files", "-co", "--exclude-standard", "-z"])
        .current_dir(cwd)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }

    let mut entries = BTreeMap::new();
    for raw in output
        .stdout
        .split(|byte| *byte == 0)
        .filter(|value| !value.is_empty())
    {
        let path = String::from_utf8(raw.to_vec()).ok()?.replace('\\', "/");
        insert_path_and_parents(&mut entries, &path);
    }
    Some(entries)
}

fn walk_entries(cwd: &Path) -> BTreeMap<String, bool> {
    let mut entries = BTreeMap::new();
    let mut pending = vec![PathBuf::new()];
    let mut visited = 0;

    while let Some(relative) = pending.pop() {
        let Ok(children) = fs::read_dir(cwd.join(&relative)) else {
            continue;
        };
        for child in children.flatten() {
            if visited >= MAX_WALK_ENTRIES {
                return entries;
            }
            visited += 1;
            let name = child.file_name();
            if name == ".git" {
                continue;
            }
            let child_relative = relative.join(name);
            let display = child_relative.to_string_lossy().replace('\\', "/");
            let is_directory = child.file_type().map(|kind| kind.is_dir()).unwrap_or(false);
            entries.insert(display, is_directory);
            if is_directory {
                pending.push(child_relative);
            }
        }
    }
    entries
}

fn insert_path_and_parents(entries: &mut BTreeMap<String, bool>, path: &str) {
    entries.insert(path.to_owned(), false);
    let mut parent = Path::new(path).parent();
    while let Some(value) = parent {
        let display = value.to_string_lossy().replace('\\', "/");
        if display.is_empty() {
            break;
        }
        entries.insert(display, true);
        parent = value.parent();
    }
}

fn fuzzy_score(query: &str, target: &str) -> Option<i32> {
    if target == query {
        return Some(1_000);
    }
    if target.starts_with(query) {
        return Some(900);
    }
    if target.contains(query) {
        return Some(700);
    }

    let mut target_chars = target.char_indices();
    let mut last = None;
    let mut gaps = 0;
    for query_char in query.chars() {
        let (index, _) = target_chars.find(|(_, target_char)| *target_char == query_char)?;
        if let Some(previous) = last {
            if index > previous + 1 {
                gaps += 1;
            }
        }
        last = Some(index);
    }
    Some(400 - gaps * 5)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fuzzy_matching_prefers_prefixes() {
        assert!(fuzzy_score("term", "terminal.tsx") > fuzzy_score("term", "src/terminal.tsx"));
        assert!(fuzzy_score("tti", "terminaltab/index.tsx").is_some());
        assert!(fuzzy_score("missing", "terminal.tsx").is_none());
    }

    #[test]
    fn paths_include_parent_directories() {
        let mut entries = BTreeMap::new();
        insert_path_and_parents(&mut entries, "src/components/Input.tsx");
        assert_eq!(entries.get("src"), Some(&true));
        assert_eq!(entries.get("src/components"), Some(&true));
        assert_eq!(entries.get("src/components/Input.tsx"), Some(&false));
    }

    #[test]
    fn workspace_paths_cannot_escape_the_root() {
        assert!(validate_relative_path("src/components/Input.tsx").is_ok());
        assert!(validate_relative_path("../secret").is_err());
        assert!(validate_relative_path("/tmp/secret").is_err());
        assert!(validate_relative_path("src/../secret").is_err());
    }
}
