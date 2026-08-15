//! Tauri commands for rich-input completion metadata.

use std::path::Path;

use crate::models::{OmpCommand, OmpPathSuggestion};
use crate::services::completion;

/// Return the effective slash commands discovered by OMP for `cwd`.
#[tauri::command]
pub fn list_omp_commands(cwd: String) -> Result<Vec<OmpCommand>, String> {
    completion::list_commands(Path::new(&cwd)).map_err(|error| error.to_string())
}

/// Return fuzzy file and directory suggestions for an OMP `@` mention.
#[tauri::command]
pub fn list_omp_paths(cwd: String, query: String) -> Result<Vec<OmpPathSuggestion>, String> {
    completion::list_paths(Path::new(&cwd), &query).map_err(|error| error.to_string())
}
