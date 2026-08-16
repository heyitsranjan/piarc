//! Tauri commands for PTY terminal management.
//!
//! Thin wrappers over `services::pty_manager` — no business logic here.
//!
//! Event protocol emitted to the frontend:
//! - `pty_output:<tab_id>`  payload: base64-encoded output chunk (String)
//! - `pty_exit:<tab_id>`    payload: exit code (i32)

use std::{env, path::PathBuf};

use tauri::{path::BaseDirectory, Emitter, Manager, State};
use tracing::{error, info};

use crate::services::pty_manager::PtyProgram;
use crate::state::AppState;

// ─── Helpers ──────────────────────────────────────────────────────────────

/// Detect the user's login shell, falling back to `/bin/zsh`.
fn login_shell() -> String {
    env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
}

fn status_extension(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let path = app
        .path()
        .resolve("piarc-status.js", BaseDirectory::Resource)
        .map_err(|error| format!("failed to resolve PiArc status extension: {error}"))?;
    if !path.is_file() {
        return Err(format!(
            "PiArc status extension is missing: {}",
            path.display()
        ));
    }
    Ok(path)
}

/// Emit a PTY output event; log on failure.
fn emit_output(app: &tauri::AppHandle, tab: &str, chunk: String) {
    if app.emit(&format!("pty_output:{tab}"), chunk).is_err() {
        error!("failed to emit PTY output");
    }
}

/// Emit a PTY exit event; log on failure.
fn emit_exit(app: &tauri::AppHandle, tab: &str, code: i32) {
    if app.emit(&format!("pty_exit:{tab}"), code).is_err() {
        error!("failed to emit PTY exit");
    }
}

// ─── Commands ─────────────────────────────────────────────────────────────

/// Spawn a new PTY for `tab_id`, loading the PiArc lifecycle extension and
/// resuming `session_id`.
///
/// The login shell remains interactive after omp exits.
///
/// If a PTY already exists for `tab_id`, this is a no-op.
#[tauri::command]
pub async fn create_pty(
    tab_id: String,
    session_id: String,
    cwd: String,
    cols: u16,
    rows: u16,
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    info!("resume PTY requested");

    if state.pty_manager.has(&tab_id) {
        info!("reused live PTY");
        return Ok(());
    }

    let shell = login_shell();
    let extension = status_extension(&app)?;
    let pm = state.pty_manager.clone();

    pm.spawn(
        tab_id.clone(),
        PtyProgram::Resume {
            session_id: &session_id,
            extension: &extension,
        },
        &cwd,
        (cols, rows),
        &shell,
        {
            let app = app.clone();
            move |tab, chunk| {
                if chunk.is_empty() {
                    emit_exit(&app, &tab, 0);
                } else {
                    emit_output(&app, &tab, chunk);
                }
            }
        },
    )
    .map_err(|error| {
        error!("resume PTY failed");
        error.to_string()
    })
}

/// Write raw input (keyboard / paste) to the PTY for `tab_id`.
#[tauri::command]
pub fn write_pty(tab_id: String, data: String, state: State<'_, AppState>) -> Result<(), String> {
    state
        .pty_manager
        .write(&tab_id, data.as_bytes())
        .map_err(|e| e.to_string())
}

/// Resize the PTY for `tab_id` (triggers SIGWINCH on Unix).
#[tauri::command]
pub fn resize_pty(
    tab_id: String,
    cols: u16,
    rows: u16,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .pty_manager
        .resize(&tab_id, cols, rows)
        .map_err(|e| e.to_string())
}

/// Kill the PTY process and remove it from the cache.
/// Safe to call even if the process has already exited.
#[tauri::command]
pub fn kill_pty(tab_id: String, state: State<'_, AppState>) {
    info!("PTY close requested");
    state.pty_manager.kill(&tab_id);
}

/// Spawn a PTY running `omp` (no --resume) to start a brand-new session.
/// omp creates a JSONL file on disk; the FS watcher emits `sessions_updated`
/// so the sidebar refreshes automatically.
#[tauri::command]
pub async fn new_session_pty(
    tab_id: String,
    cwd: String,
    cols: u16,
    rows: u16,
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    info!("new OMP PTY requested");

    let shell = login_shell();
    let extension = status_extension(&app)?;
    let pm = state.pty_manager.clone();

    pm.spawn(
        tab_id.clone(),
        PtyProgram::NewSession(&extension),
        &cwd,
        (cols, rows),
        &shell,
        {
            let app = app.clone();
            move |tab, chunk| {
                if chunk.is_empty() {
                    emit_exit(&app, &tab, 0);
                } else {
                    emit_output(&app, &tab, chunk);
                }
            }
        },
    )
    .map_err(|error| {
        error!("new OMP PTY failed");
        error.to_string()
    })
}

/// Spawn a PTY running the user's login shell without starting omp.
#[tauri::command]
pub async fn shell_pty(
    tab_id: String,
    cwd: String,
    cols: u16,
    rows: u16,
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    info!("shell PTY requested");

    let shell = login_shell();
    let pm = state.pty_manager.clone();

    pm.spawn(
        tab_id.clone(),
        PtyProgram::Shell,
        &cwd,
        (cols, rows),
        &shell,
        {
            let app = app.clone();
            move |tab, chunk| {
                if chunk.is_empty() {
                    emit_exit(&app, &tab, 0);
                } else {
                    emit_output(&app, &tab, chunk);
                }
            }
        },
    )
    .map_err(|error| {
        error!("shell PTY failed");
        error.to_string()
    })
}
