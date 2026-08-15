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

#[cfg(test)]
mod tests {
    use super::{path_from_shell_stdout, status};

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
}
