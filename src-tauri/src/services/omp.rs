use std::{env, path::Path, process::Command};

use anyhow::{Context, Result};
use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OmpStatus {
    pub installed: bool,
    pub path: Option<String>,
    pub version: Option<String>,
    pub error: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OmpUpdate {
    pub current_version: Option<String>,
    pub available_version: Option<String>,
}

pub fn status() -> OmpStatus {
    match detect() {
        Ok((path, version)) => OmpStatus {
            installed: true,
            path: Some(path),
            version,
            error: None,
        },
        Err(error) => OmpStatus {
            installed: false,
            path: None,
            version: None,
            error: Some(error.to_string()),
        },
    }
}

pub fn check_update() -> Result<OmpUpdate> {
    let (path, _) = detect()?;
    let output = Command::new(path)
        .args(["update", "--check"])
        .output()
        .context("check OMP update")?;
    anyhow::ensure!(
        output.status.success(),
        "OMP update check failed: {}",
        command_output(&output)
    );
    Ok(parse_update_output(&command_output(&output)))
}

pub fn install_update() -> Result<OmpStatus> {
    let (path, _) = detect()?;
    let output = Command::new(path)
        .arg("update")
        .output()
        .context("install OMP update")?;
    anyhow::ensure!(
        output.status.success(),
        "OMP update failed: {}",
        command_output(&output)
    );
    Ok(status())
}

fn detect() -> Result<(String, Option<String>)> {
    let shell = env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    anyhow::ensure!(
        Path::new(&shell).is_absolute(),
        "login shell path is not absolute"
    );
    anyhow::ensure!(Path::new(&shell).is_file(), "login shell is unavailable");

    let output = Command::new(shell)
        .args(["-l", "-c", "command -v omp"])
        .output()
        .context("check OMP installation")?;
    anyhow::ensure!(
        output.status.success(),
        "OMP is not installed or is not on the login PATH"
    );

    let path = path_from_shell_stdout(&output.stdout)?;
    anyhow::ensure!(
        Path::new(&path).is_file(),
        "OMP resolved to an invalid path"
    );

    let version_output = Command::new(&path).arg("--version").output();
    let version = version_output.ok().and_then(|output| {
        let text = if output.stdout.is_empty() {
            output.stderr
        } else {
            output.stdout
        };
        let text = String::from_utf8_lossy(&text).trim().to_string();
        (!text.is_empty()).then_some(text)
    });

    Ok((path, version))
}

fn path_from_shell_stdout(stdout: &[u8]) -> Result<String> {
    let text = String::from_utf8(stdout.to_vec()).context("OMP path was not valid UTF-8")?;
    text.lines()
        .rev()
        .map(str::trim)
        .find(|line| !line.is_empty() && Path::new(line).is_absolute())
        .map(str::to_owned)
        .context("OMP resolved to an invalid path")
}

fn command_output(output: &std::process::Output) -> String {
    let mut text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if !stderr.is_empty() {
        if !text.is_empty() {
            text.push('\n');
        }
        text.push_str(&stderr);
    }
    text
}

fn parse_update_output(output: &str) -> OmpUpdate {
    let version = |prefix| {
        output
            .lines()
            .map(str::trim)
            .find_map(|line| line.strip_prefix(prefix).map(str::trim))
            .filter(|version| !version.is_empty())
            .map(str::to_owned)
    };
    OmpUpdate {
        current_version: version("Current version:"),
        available_version: version("New version available:"),
    }
}

#[cfg(test)]
mod tests {
    use super::{parse_update_output, path_from_shell_stdout, status};

    #[test]
    fn status_never_panics() {
        let result = status();
        assert_eq!(result.installed, result.path.is_some());
    }

    #[test]
    fn detection_ignores_login_shell_startup_output() {
        let output = b"Welcome to this shell\n/opt/homebrew/bin/omp\n";
        assert_eq!(
            path_from_shell_stdout(output).unwrap(),
            "/opt/homebrew/bin/omp"
        );
    }

    #[test]
    fn parses_available_update_versions() {
        let update =
            parse_update_output("Current version: 17.3.4\nNew version available: 17.3.5\n");
        assert_eq!(update.current_version.as_deref(), Some("17.3.4"));
        assert_eq!(update.available_version.as_deref(), Some("17.3.5"));
    }

    #[test]
    fn parses_current_version_without_update() {
        let update = parse_update_output("Current version: 17.3.5\nAlready up to date\n");
        assert_eq!(update.current_version.as_deref(), Some("17.3.5"));
        assert_eq!(update.available_version, None);
    }
}
