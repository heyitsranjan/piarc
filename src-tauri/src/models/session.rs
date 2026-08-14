//! Session data models.
//!
//! `OmpSession` mirrors the TypeScript `OmpSession` interface exactly —
//! both sides of the IPC boundary must stay in sync.
//! `TitleSlot` and `SessionHeader` are internal parsing helpers only.

use serde::{Deserialize, Serialize};

/// A single omp agent session, safe to send across the Tauri IPC boundary.
///
/// Field names use `camelCase` (`#[serde(rename_all = "camelCase")]`) to match
/// the TypeScript interface without any translation on the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OmpSession {
    /// UUID from `{"type":"session","id":"..."}` header line.
    pub id: String,
    /// Absolute path to the `.jsonl` file.
    pub path: String,
    /// Display name: title slot > header title > first user message > "Untitled".
    pub title: String,
    /// Working directory recorded in the session header.
    pub cwd: String,
    /// File mtime as a Unix timestamp (seconds).
    pub modified: i64,
    /// First user message text — used as subtitle and for search.
    pub first_message: String,
}

// ─── Internal parsing types ───────────────────────────────────────────────

/// The fixed-width 256-byte title slot at the start of every session file.
/// Padded with spaces via the `"pad"` field to reach exactly 256 bytes.
#[derive(Debug, Deserialize)]
pub(crate) struct TitleSlot {
    pub title: Option<String>,
}

/// The session header entry (`{"type":"session",...}`).
#[derive(Debug, Deserialize)]
pub(crate) struct SessionHeader {
    pub id: Option<String>,
    pub cwd: Option<String>,
    pub title: Option<String>,
}

/// Minimal representation of a message entry used to extract first user text.
#[derive(Debug, Deserialize)]
pub(crate) struct MessageEntry {
    pub message: Option<MessageBody>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct MessageBody {
    pub role: Option<String>,
    pub content: Option<serde_json::Value>,
}
