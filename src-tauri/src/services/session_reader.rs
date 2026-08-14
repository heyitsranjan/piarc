//! Session discovery and JSONL parsing service.
//!
//! Scans `~/.omp/agent/sessions/<encoded-cwd>/*.jsonl`, reads the first 4 KiB
//! of each file (title slot + session header + first few entries), and returns
//! a list sorted by mtime descending.
//!
//! No Tauri dependencies — pure business logic, independently testable.

use std::{
    fs::{self, OpenOptions},
    io::{BufRead, BufReader, Read, Seek, SeekFrom, Write},
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use anyhow::{Context, Result};
use serde_json::Value;
use tracing::{debug, warn};

use crate::models::session::{MessageBody, OmpSession, SessionHeader, TitleSlot};

/// Max bytes read from the start of each JSONL file (title slot + header + first entries).
const READ_PREFIX_BYTES: u64 = 4096;

// ─── Public API ───────────────────────────────────────────────────────────

/// Scan the omp sessions root and return all parseable sessions, newest-first.
///
/// Returns an empty `Vec` (not an error) when the directory doesn't exist yet —
/// omp hasn't been used on this machine.
pub fn list_all_sessions() -> Result<Vec<OmpSession>> {
    let root = sessions_root();

    if !root.exists() {
        debug!("sessions root not found: {}", root.display());
        return Ok(vec![]);
    }

    debug!("scanning sessions root: {}", root.display());
    let mut sessions = Vec::new();

    for bucket in read_dir_sorted(&root)? {
        if !bucket.is_dir() {
            continue;
        }

        for file in read_dir_sorted(&bucket)? {
            if file.extension().and_then(|e| e.to_str()) != Some("jsonl") {
                continue;
            }

            match parse_session_file(&file) {
                Ok(s) => {
                    debug!("parsed session: {} ({})", s.id, s.title);
                    sessions.push(s);
                },
                Err(e) => {
                    warn!("skip {:?}: {e}", file.file_name());
                },
            }
        }
    }

    sessions.sort_by(|a, b| b.modified.cmp(&a.modified));
    debug!("found {} sessions", sessions.len());
    Ok(sessions)
}

/// Permanently delete a session JSONL file from disk.
pub fn delete_session(path: &str) -> Result<()> {
    fs::remove_file(path).with_context(|| format!("delete session: {path}"))
}

/// Rename a session by rewriting its 256-byte title slot and appending
/// a `title_change` audit entry — identical to what omp does internally.
///
/// The title slot is the very first line of every session JSONL file,
/// padded with spaces to exactly 256 bytes so listings can read it
/// without scanning the rest of the file.
///
/// Setting `source = "user"` prevents omp from auto-renaming the session.
pub fn rename_session(path: &str, new_title: &str) -> Result<()> {
    use chrono::Utc;

    let now = Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string();

    // ── Build new 256-byte title slot ────────────────────────────────────
    // Format (total must be exactly 256 bytes including the trailing \n):
    //   {"type":"title","v":1,"title":<JSON>,"source":"user","updatedAt":"<ISO>","pad":"<SPACES>"}\n
    let title_json = serde_json::to_string(new_title)?;
    let prefix = format!(
        r#"{{"type":"title","v":1,"title":{title_json},"source":"user","updatedAt":"{now}","pad":""#
    );
    let suffix = "\"}\n";
    let total: usize = 256;
    let fixed_len = prefix.len() + suffix.len();

    anyhow::ensure!(
        fixed_len <= total,
        "title too long ({} bytes encoded); maximum is ~{} characters",
        title_json.len(),
        total.saturating_sub(fixed_len) + title_json.len() - 2
    );

    let pad_len = total - fixed_len;
    let title_slot = format!("{}{}{}", prefix, " ".repeat(pad_len), suffix);
    debug_assert_eq!(title_slot.len(), 256, "title slot must be exactly 256 bytes");

    // ── Overwrite first 256 bytes ────────────────────────────────────────
    let mut file = OpenOptions::new()
        .read(true)
        .write(true)
        .open(path)
        .with_context(|| format!("open session for rename: {path}"))?;

    file.seek(SeekFrom::Start(0))?;
    file.write_all(title_slot.as_bytes())?;

    // ── Append title_change audit entry ──────────────────────────────────
    let entry_id = &uuid::Uuid::new_v4().to_string()[..8];
    let entry = serde_json::json!({
        "type":      "title_change",
        "id":        entry_id,
        "parentId":  serde_json::Value::Null,
        "timestamp": now,
        "title":     new_title,
        "source":    "user",
        "trigger":   "rename"
    });
    let entry_line = format!("{}\n", serde_json::to_string(&entry)?);

    file.seek(SeekFrom::End(0))?;
    file.write_all(entry_line.as_bytes())?;
    file.flush()?;

    tracing::info!("renamed session {path:?} → {new_title:?}");
    Ok(())
}

// ─── Parsing ──────────────────────────────────────────────────────────────

/// Read and parse the first `READ_PREFIX_BYTES` of a JSONL session file.
///
/// Title resolution priority:
/// 1. Fixed-width title slot (`{"type":"title","title":"..."}`)
/// 2. Session header title (`{"type":"session","title":"..."}`)
/// 3. First user message text
/// 4. `"Untitled"` fallback
fn parse_session_file(path: &Path) -> Result<OmpSession> {
    let file = fs::File::open(path).with_context(|| format!("open {path:?}"))?;
    let mtime = file
        .metadata()?
        .modified()
        .unwrap_or(SystemTime::UNIX_EPOCH)
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    let reader = BufReader::new(file.take(READ_PREFIX_BYTES));

    let mut title_slot: Option<String> = None;
    let mut header_title: Option<String> = None;
    let mut session_id: Option<String> = None;
    let mut session_cwd: String = String::new();
    let mut first_message: String = String::new();

    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => break, // partial read at the 4 KiB boundary
        };

        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let json: Value = match serde_json::from_str(trimmed) {
            Ok(v) => v,
            Err(_) => continue,
        };

        match json.get("type").and_then(Value::as_str) {
            Some("title") => {
                if let Ok(slot) = serde_json::from_value::<TitleSlot>(json) {
                    title_slot = slot.title.filter(|t| !t.is_empty());
                }
            },
            Some("session") => {
                if let Ok(hdr) = serde_json::from_value::<SessionHeader>(json) {
                    session_id = hdr.id;
                    session_cwd = hdr.cwd.unwrap_or_default();
                    header_title = hdr.title.filter(|t| !t.is_empty());
                }
            },
            Some("message") if first_message.is_empty() => {
                if let Ok(entry) =
                    serde_json::from_value::<crate::models::session::MessageEntry>(json)
                {
                    if let Some(msg) = entry.message {
                        if msg.role.as_deref() == Some("user") {
                            first_message = extract_text(&msg).unwrap_or_default();
                        }
                    }
                }
            },
            _ => {},
        }
    }

    let id = session_id.ok_or_else(|| anyhow::anyhow!("missing session id in {path:?}"))?;

    let title = title_slot
        .or(header_title)
        .or_else(|| {
            if first_message.is_empty() {
                None
            } else {
                Some(first_message.clone())
            }
        })
        .unwrap_or_else(|| "Untitled".to_string());

    Ok(OmpSession {
        id,
        path: path.to_string_lossy().into_owned(),
        title,
        cwd: session_cwd,
        modified: mtime,
        first_message,
    })
}

/// Extract the first line of text from a message `content` field.
/// Content may be a plain string or `[{"type":"text","text":"..."}]` blocks.
fn extract_text(msg: &MessageBody) -> Option<String> {
    match msg.content.as_ref()? {
        Value::String(s) => Some(first_line(s)),
        Value::Array(blocks) => blocks
            .iter()
            .find(|b| b.get("type").and_then(Value::as_str) == Some("text"))
            .and_then(|b| b.get("text").and_then(Value::as_str))
            .map(first_line),
        _ => None,
    }
}

fn first_line(s: &str) -> String {
    s.lines()
        .next()
        .unwrap_or("")
        .trim()
        .chars()
        .take(200)
        .collect()
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/// Canonical omp sessions root: `~/.omp/agent/sessions`.
pub fn sessions_root() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("/"))
        .join(".omp/agent/sessions")
}

/// Read directory entries and return sorted `PathBuf`s, skipping errors.
fn read_dir_sorted(dir: &Path) -> Result<Vec<PathBuf>> {
    let mut entries: Vec<PathBuf> = fs::read_dir(dir)?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .collect();
    entries.sort();
    Ok(entries)
}

// ─── Tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sessions_root_contains_omp() {
        let root = sessions_root();
        assert!(root.to_str().unwrap().contains(".omp"));
    }

    #[test]
    fn first_line_trims_and_truncates() {
        let s = "hello\nworld";
        assert_eq!(first_line(s), "hello");
    }
}
