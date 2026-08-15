//! Tauri commands for PTY terminal management.
//!
//! Thin wrappers over `services::pty_manager` — no business logic here.
//!
//! Event protocol emitted to the frontend:
//! - `pty_output:<tab_id>`  payload: base64-encoded output chunk (String)
//! - `pty_exit:<tab_id>`    payload: exit code (i32)

use std::env;

use tauri::{Emitter, State};
use tracing::{error, info};

use crate::services::pty_manager::PtyProgram;
use crate::state::AppState;

// ─── Helpers ──────────────────────────────────────────────────────────────

/// Detect the user's login shell, falling back to `/bin/zsh`.
fn login_shell() -> String {
    env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
}

/// Emit a PTY output event; log on failure.
fn emit_output(app: &tauri::AppHandle, tab: &str, chunk: String) {
    if let Err(e) = app.emit(&format!("pty_output:{tab}"), chunk) {
        error!("emit pty_output:{tab}: {e}");
    }
}

/// Emit a PTY exit event; log on failure.
fn emit_exit(app: &tauri::AppHandle, tab: &str, code: i32) {
    if let Err(e) = app.emit(&format!("pty_exit:{tab}"), code) {
        error!("emit pty_exit:{tab}: {e}");
    }
}

// ─── Commands ─────────────────────────────────────────────────────────────

/// Spawn a new PTY for `tab_id`, running `omp --resume <session_id>`.
///
/// Shell command: `cd '<cwd>'; omp --resume <id>; exec <shell>`
/// The `exec <shell>` keeps the window interactive after omp exits.
///
/// If a PTY already exists for `tab_id` (pre-warm hit), this is a no-op.
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
    info!("create_pty tab={tab_id} session={session_id}");

    if state.pty_manager.has(&tab_id) {
        info!("create_pty: cache hit tab={tab_id}");
        return Ok(());
    }

    let shell = login_shell();
    let pm = state.pty_manager.clone();

    pm.spawn(
        tab_id.clone(),
        PtyProgram::Resume(&session_id),
        &cwd,
        cols,
        rows,
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
    .map_err(|e| {
        error!("create_pty failed tab={tab_id}: {e}");
        e.to_string()
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
    info!("kill_pty tab={tab_id}");
    state.pty_manager.kill(&tab_id);
}

/// Pre-warm a PTY for a session before the user clicks it.
///
/// Uses cache key `"prewarm:<session_id>"`. The frontend must pass this same
/// string as `tab_id` to `create_pty` in order to get a cache hit.
#[tauri::command]
pub async fn prewarm_pty(
    session_id: String,
    cwd: String,
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let tab_id = format!("prewarm:{session_id}");
    info!("prewarm_pty tab={tab_id}");

    if state.pty_manager.has(&tab_id) {
        return Ok(());
    }

    let shell = login_shell();
    let pm = state.pty_manager.clone();

    pm.spawn(
        tab_id,
        PtyProgram::Resume(&session_id),
        &cwd,
        120,
        30,
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
    .map_err(|e| e.to_string())
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
    info!("new_session_pty tab={tab_id} cwd={cwd}");

    let shell = login_shell();
    let pm = state.pty_manager.clone();

    pm.spawn(
        tab_id.clone(),
        PtyProgram::NewSession,
        &cwd,
        cols,
        rows,
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
    .map_err(|e| {
        log::error!("new_session_pty failed: {e}");
        e.to_string()
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
    info!("shell_pty tab={tab_id} cwd={cwd}");

    let shell = login_shell();
    let pm = state.pty_manager.clone();

    pm.spawn(
        tab_id.clone(),
        PtyProgram::Shell,
        &cwd,
        cols,
        rows,
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
    .map_err(|e| {
        error!("shell_pty failed tab={tab_id}: {e}");
        e.to_string()
    })
}
