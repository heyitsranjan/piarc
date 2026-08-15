//! Tauri application library root.
//!
//! Wires together plugins, managed state, the filesystem watcher, tray icon,
//! logging, and command handlers.

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

use commands::{completion, custom_models, editors, git, sessions, system, terminal};
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
                        file_name: Some("ompx".into()),
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
        .plugin(tauri_plugin_dialog::init())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        // ── Setup ──────────────────────────────────────────────────────────
        .setup(|app| {
            info!("OMPX starting up v{}", env!("CARGO_PKG_VERSION"));

            // Managed state
            let app_state = AppState::new();
            match watcher::start_watcher(app.handle().clone()) {
                Ok(w) => {
                    info!("FS watcher started");
                    *app_state.watcher.lock() = Some(w);
                }
                Err(_) => {
                    log::warn!("FS watcher failed");
                }
            }
            app.manage(app_state);

            // ── Tray icon ─────────────────────────────────────────────────
            let show = MenuItem::with_id(app, "show", "Show OMPX", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let sep = tauri::menu::PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(app, &[&show, &sep, &quit])?;

            let _tray = TrayIconBuilder::new()
                .icon(tauri::include_image!("icons/44x44.png"))
                .icon_as_template(true)
                .menu(&menu)
                .tooltip("OMPX")
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
                        button: MouseButton::Left,
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
            custom_models::test_custom_model,
            custom_models::save_custom_model,
            custom_models::list_custom_models,
            custom_models::update_custom_model,
            custom_models::delete_custom_model,
            custom_models::list_model_roles,
            custom_models::set_model_role,
            completion::list_omp_commands,
            completion::list_omp_paths,
            completion::list_workspace_entries,
            completion::read_workspace_file,
            editors::list_installed_editors,
            editors::open_folder_in_editor,
            git::get_git_changes,
            git::get_git_file_diff,
            sessions::list_sessions,
            system::get_omp_status,
            sessions::delete_session,
            system::get_machine_permissions,
            system::open_permission_settings,
            sessions::rename_session,
            terminal::create_pty,
            terminal::write_pty,
            terminal::resize_pty,
            terminal::kill_pty,
            terminal::new_session_pty,
            terminal::shell_pty,
        ])
        .run(tauri::generate_context!())
        .expect("error while running OMPX");
}
