//! Tauri application library root.
//!
//! Wires together plugins, managed state, the FS watcher, tray icon,
//! auto-updater, logging, and all command handlers.

mod commands;
mod models;
mod services;
mod state;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};
use tauri_plugin_log::{Target, TargetKind};
use tracing::info;

use commands::{sessions, terminal};
use services::watcher;
use state::AppState;

/// Build and run the Tauri application.
pub fn run() {
    tauri::Builder::default()
        // ── Logging ────────────────────────────────────────────────────────
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir {
                        file_name: Some("oh-my-pi".into()),
                    }),
                    Target::new(TargetKind::Webview),
                ])
                .level(if cfg!(debug_assertions) {
                    log::LevelFilter::Debug
                } else {
                    log::LevelFilter::Info
                })
                .build(),
        )
        // ── Other plugins ──────────────────────────────────────────────────
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        // ── Setup ──────────────────────────────────────────────────────────
        .setup(|app| {
            info!("Oh My Pi starting up v{}", env!("CARGO_PKG_VERSION"));

            // Managed state
            let app_state = AppState::new();
            match watcher::start_watcher(app.handle().clone()) {
                Ok(w)  => { info!("FS watcher started"); *app_state.watcher.lock() = Some(w); }
                Err(e) => { log::warn!("FS watcher failed: {e}"); }
            }
            app.manage(app_state);

            // ── Tray icon ─────────────────────────────────────────────────
            let show   = MenuItem::with_id(app, "show",   "Show Oh My Pi", true, None::<&str>)?;
            let quit   = MenuItem::with_id(app, "quit",   "Quit",          true, None::<&str>)?;
            let sep    = tauri::menu::PredefinedMenuItem::separator(app)?;
            let menu   = Menu::with_items(app, &[&show, &sep, &quit])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("Oh My Pi")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button:       MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            if w.is_visible().unwrap_or(false) {
                                let _ = w.hide();
                            } else {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        // ── Commands ───────────────────────────────────────────────────────
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
