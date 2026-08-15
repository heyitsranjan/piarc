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
    list_sessions_from(&sessions_root())
}

fn list_sessions_from(root: &Path) -> Result<Vec<OmpSession>> {
    if !root.exists() {
        debug!("sessions root not found");
        return Ok(vec![]);
    }

    debug!("scanning sessions");
    let mut sessions = Vec::new();

    for bucket in read_dir_sorted(root)? {
        let metadata = match fs::symlink_metadata(&bucket) {
            Ok(metadata) => metadata,
            Err(_) => {
                warn!("skipped unreadable session directory");
                continue;
            }
        };
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            continue;
        }

        for candidate in read_dir_sorted(&bucket)? {
            if candidate
                .extension()
                .and_then(|extension| extension.to_str())
                != Some("jsonl")
            {
                continue;
            }

            let file = match validated_session_path(&candidate, root) {
                Ok(file) => file,
                Err(_) => {
                    warn!("skipped invalid session file");
                    continue;
                }
            };
            match parse_session_file(&file) {
                Ok(session) => sessions.push(session),
                Err(_) => warn!("skipped unreadable session file"),
            }
        }
    }

    sessions.sort_by_key(|session| std::cmp::Reverse(session.modified));
    debug!("found {} sessions", sessions.len());
    Ok(sessions)
}

/// Permanently delete a session JSONL file from disk.
pub fn delete_session(path: &str) -> Result<()> {
    let path = validated_session_path(Path::new(path), &sessions_root())?;
    fs::remove_file(&path).with_context(|| format!("delete session: {}", path.display()))
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

    let path = validated_session_path(Path::new(path), &sessions_root())?;
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
    debug_assert_eq!(
        title_slot.len(),
        256,
        "title slot must be exactly 256 bytes"
    );

    // ── Overwrite first 256 bytes ────────────────────────────────────────
    let mut file = OpenOptions::new()
        .read(true)
        .write(true)
        .open(&path)
        .with_context(|| format!("open session for rename: {}", path.display()))?;

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

    tracing::info!("renamed session");
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
            }
            Some("session") => {
                if let Ok(hdr) = serde_json::from_value::<SessionHeader>(json) {
                    session_id = hdr.id;
                    session_cwd = hdr.cwd.unwrap_or_default();
                    header_title = hdr.title.filter(|t| !t.is_empty());
                }
            }
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
            }
            _ => {}
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

/// Resolve a user-supplied session path and prove it names a regular JSONL file
/// in one direct child directory of the canonical OMP sessions root.
fn validated_session_path(path: &Path, root: &Path) -> Result<PathBuf> {
    anyhow::ensure!(
        path.extension().and_then(|ext| ext.to_str()) == Some("jsonl"),
        "not a session file"
    );
    anyhow::ensure!(
        !fs::symlink_metadata(path)?.file_type().is_symlink(),
        "session path must not be a symlink"
    );

    let root = root.canonicalize().context("resolve sessions root")?;
    let path = path.canonicalize().context("resolve session path")?;
    let metadata = fs::metadata(&path)?;
    anyhow::ensure!(metadata.is_file(), "session path is not a regular file");

    let parent = path.parent().context("session path has no parent")?;
    anyhow::ensure!(
        parent.parent() == Some(root.as_path()),
        "session path is outside the OMP sessions root"
    );
    Ok(path)
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

    #[test]
    fn session_path_must_be_a_direct_jsonl_child() {
        let temp = std::env::temp_dir().join(format!("ompx-path-test-{}", uuid::Uuid::new_v4()));
        let root = temp.join("sessions");
        let bucket = root.join("project");
        fs::create_dir_all(&bucket).unwrap();
        let session = bucket.join("session.jsonl");
        fs::write(&session, "{}\n").unwrap();
        let outside = temp.join("outside.jsonl");
        fs::write(&outside, "{}\n").unwrap();
        let nested = bucket.join("nested");
        fs::create_dir(&nested).unwrap();
        let nested_session = nested.join("session.jsonl");
        fs::write(&nested_session, "{}\n").unwrap();

        assert_eq!(
            validated_session_path(&session, &root).unwrap(),
            session.canonicalize().unwrap()
        );
        assert!(validated_session_path(&outside, &root).is_err());
        assert!(validated_session_path(&nested_session, &root).is_err());
        assert!(validated_session_path(&bucket.join("not-json.txt"), &root).is_err());

        fs::remove_dir_all(temp).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn session_path_rejects_symlinks() {
        use std::os::unix::fs::symlink;

        let temp = std::env::temp_dir().join(format!("ompx-link-test-{}", uuid::Uuid::new_v4()));
        let root = temp.join("sessions");
        let bucket = root.join("project");
        fs::create_dir_all(&bucket).unwrap();
        let target = bucket.join("target.jsonl");
        let link = bucket.join("link.jsonl");
        fs::write(&target, "{}\n").unwrap();
        symlink(&target, &link).unwrap();

        assert!(validated_session_path(&link, &root).is_err());
        fs::remove_dir_all(temp).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn discovery_ignores_symlinked_buckets_and_files() {
        use std::os::unix::fs::symlink;

        let temp =
            std::env::temp_dir().join(format!("ompx-discovery-link-test-{}", uuid::Uuid::new_v4()));
        let root = temp.join("sessions");
        let bucket = root.join("project");
        let outside = temp.join("outside");
        fs::create_dir_all(&bucket).unwrap();
        fs::create_dir_all(&outside).unwrap();
        fs::write(
            outside.join("outside.jsonl"),
            "{\"type\":\"session\",\"id\":\"outside\",\"cwd\":\"/tmp\"}\n",
        )
        .unwrap();
        fs::write(
            bucket.join("target.jsonl"),
            "{\"type\":\"session\",\"id\":\"target\",\"cwd\":\"/tmp\"}\n",
        )
        .unwrap();
        symlink(&outside, root.join("linked-project")).unwrap();
        symlink(
            bucket.join("target.jsonl"),
            bucket.join("linked-session.jsonl"),
        )
        .unwrap();

        let sessions = list_sessions_from(&root).unwrap();
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].id, "target");
        fs::remove_dir_all(temp).unwrap();
    }
}
