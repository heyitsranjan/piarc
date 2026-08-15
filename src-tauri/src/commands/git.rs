//! Tauri commands for read-only Git review data.

use std::path::Path;

use crate::models::GitChangesSnapshot;
use crate::services::git_repository;

/// Return staged, unstaged, and untracked files for the repository containing `cwd`.
#[tauri::command]
pub fn get_git_changes(cwd: String) -> Result<GitChangesSnapshot, String> {
    git_repository::get_changes(Path::new(&cwd)).map_err(|error| error.to_string())
}

/// Return a unified patch for one repository-relative path.
#[tauri::command]
pub fn get_git_file_diff(
    cwd: String,
    path: String,
    staged: bool,
    untracked: bool,
) -> Result<String, String> {
    git_repository::get_file_diff(Path::new(&cwd), &path, staged, untracked)
        .map_err(|error| error.to_string())
}
