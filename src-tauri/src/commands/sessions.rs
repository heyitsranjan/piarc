//! Tauri commands for session management.
//!
//! These are thin wrappers — all logic lives in `services::session_reader`.

use tauri::State;

use crate::models::OmpSession;
use crate::services::session_reader;
use crate::state::AppState;

/// List all omp sessions from `~/.omp/agent/sessions/`, newest-first.
///
/// Returns an empty array if the directory does not exist (omp not installed).
/// Returns a Tauri error string on I/O failure so the frontend can show an error state.
#[tauri::command]
pub fn list_sessions(_state: State<'_, AppState>) -> Result<Vec<OmpSession>, String> {
    session_reader::list_all_sessions().map_err(|e| e.to_string())
}

/// Permanently delete a session file from disk.
///
/// # Errors
/// Returns a descriptive error string if the file cannot be removed
/// (e.g. already deleted, permission denied).
#[tauri::command]
pub fn delete_session(path: String, _state: State<'_, AppState>) -> Result<(), String> {
    session_reader::delete_session(&path).map_err(|e| e.to_string())
}
