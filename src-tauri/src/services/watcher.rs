//! File-system watcher for the omp sessions directory.
//!
//! Uses the `notify` crate to watch `~/.omp/agent/sessions/` recursively.
//! When any change is detected (new session, delete, title update), emits a
//! `sessions_updated` Tauri event to the frontend so the sidebar refreshes.
//!
//! This module has **no business logic** — it only bridges `notify` → Tauri events.

use std::time::Duration;

use anyhow::Result;
use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter};

use crate::services::session_reader::sessions_root;

/// Tauri event name emitted on any sessions-directory change.
pub const EVENT_SESSIONS_UPDATED: &str = "sessions_updated";

/// Start watching `~/.omp/agent/sessions/` in the background.
///
/// Returns the watcher handle — **keep it alive** for the duration of the app.
/// Dropping it stops the watcher.
pub fn start_watcher(app: AppHandle) -> Result<RecommendedWatcher> {
    let root = sessions_root();

    // Ensure the directory exists before watching (omp might not be installed yet)
    std::fs::create_dir_all(&root)?;

    let mut watcher = RecommendedWatcher::new(
        move |result: notify::Result<Event>| {
            if result.is_ok() {
                // Debounced: any change fires the event; frontend debounces on its side
                if let Err(e) = app.emit(EVENT_SESSIONS_UPDATED, ()) {
                    eprintln!("[watcher] emit error: {e}");
                }
            }
        },
        Config::default().with_poll_interval(Duration::from_secs(2)),
    )?;

    watcher.watch(&root, RecursiveMode::Recursive)?;
    Ok(watcher)
}
