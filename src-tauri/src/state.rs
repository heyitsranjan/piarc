//! Tauri managed application state.
//!
//! `AppState` is registered once in `lib.rs` via `app.manage(AppState::new())`
//! and injected into every command handler that needs it.

use notify::RecommendedWatcher;
use parking_lot::Mutex;
use std::sync::Arc;

use crate::services::pty_manager::PtyManager;

/// Global application state shared across all Tauri command handlers.
pub struct AppState {
    /// LRU cache of live PTY processes.
    pub pty_manager: Arc<PtyManager>,
    /// File-system watcher handle — must stay alive for the session of the app.
    /// Wrapped in `Option` so it can be set after `AppState::new()` in setup.
    pub watcher: Mutex<Option<RecommendedWatcher>>,
}

impl AppState {
    /// Create a new, empty `AppState`.
    pub fn new() -> Self {
        Self {
            pty_manager: Arc::new(PtyManager::new()),
            watcher: Mutex::new(None),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
