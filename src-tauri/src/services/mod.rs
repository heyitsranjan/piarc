//! Business-logic services — no Tauri command boilerplate here.
//!
//! - `session_reader` — JSONL parsing and directory scanning
//! - `git_repository` — read-only Git status and patch inspection
//! - `pty_manager`    — cross-platform PTY lifecycle (portable-pty)
//! - `watcher`        — FS watcher bridging notify → Tauri events
pub mod completion;
pub mod editors;
pub mod git_repository;
pub mod omp;
pub mod permissions;
pub mod pty_manager;
pub mod session_reader;
pub mod watcher;
