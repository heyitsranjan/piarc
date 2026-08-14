//! Tauri application library root.
//!
//! Wires together plugins, managed state, the FS watcher, logging,
//! and all command handlers.

mod commands;
mod models;
mod services;
mod state;

use tauri::Manager;
use tauri_plugin_log::{Target, TargetKind};
use tracing::info;

use commands::{sessions, terminal};
use services::watcher;
use state::AppState;

/// Build and run the Tauri application.
pub fn run() {
    tauri::Builder::default()
        // ── Logging — writes to platform log file + DevTools console ───────
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir { file_name: Some("oh-my-pi".into()) }),
                    Target::new(TargetKind::Webview),
                ])
                .level(if cfg!(debug_assertions) {
                    log::LevelFilter::Debug
                } else {
                    log::LevelFilter::Info
                })
                .build(),
        )
        // ── Other plugins ───────────────────────────────────────────────────
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        // ── Setup ───────────────────────────────────────────────────────────
        .setup(|app| {
            info!("Oh My Pi starting up");

            let app_state = AppState::new();

            match watcher::start_watcher(app.handle().clone()) {
                Ok(w) => {
                    info!("FS watcher started");
                    *app_state.watcher.lock() = Some(w);
                }
                Err(e) => {
                    // Non-fatal — live reload won't work but app still runs
                    log::warn!("FS watcher failed to start: {e}");
                }
            }

            app.manage(app_state);
            Ok(())
        })
        // ── Commands ────────────────────────────────────────────────────────
        .invoke_handler(tauri::generate_handler![
            sessions::list_sessions,
            sessions::delete_session,
            terminal::create_pty,
            terminal::write_pty,
            terminal::resize_pty,
            terminal::kill_pty,
            terminal::prewarm_pty,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Oh My Pi");
}
