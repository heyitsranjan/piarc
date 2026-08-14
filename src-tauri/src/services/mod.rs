//! Business-logic services — no Tauri command boilerplate here.
//!
//! - `session_reader` — JSONL parsing and directory scanning
//! - `pty_manager`    — cross-platform PTY lifecycle (portable-pty)
//! - `watcher`        — FS watcher bridging notify → Tauri events
pub mod pty_manager;
pub mod session_reader;
pub mod watcher;
