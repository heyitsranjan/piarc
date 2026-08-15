//! PTY lifecycle manager — cross-platform via `portable-pty`.
//!
//! Maintains an LRU cache of live PTY processes keyed by `tab_id`.
//! PTYs stay alive across tab switches; switching back is instant (no restart).
//! The cache has a configurable hard cap; the least-recently-used entry is
//! evicted when the cap is reached.

use std::io::{Read, Write};
use std::{collections::HashMap, path::Path};

use anyhow::{Context, Result};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use parking_lot::Mutex;
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use tracing::{debug, info, warn};

/// Hard cap on live PTY processes. LRU eviction applies above this limit.
const PTY_CACHE_SIZE: usize = 8;

// ─── Types ────────────────────────────────────────────────────────────────

/// One live PTY session stored in the cache.
pub struct PtySession {
    pub writer: Box<dyn Write + Send>,
    pub child: Box<dyn Child + Send + Sync>,
    pub size: PtySize,
    pub master: Box<dyn MasterPty + Send>,
}

#[derive(Clone, Copy, Debug)]
pub enum PtyProgram<'a> {
    NewSession(&'a Path),
    Resume {
        session_id: &'a str,
        extension: &'a Path,
    },
    Shell,
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}
fn omp_command(extension: &Path) -> Result<String> {
    let extension = extension
        .to_str()
        .context("OMPX status extension path is not valid UTF-8")?;
    Ok(format!("omp --extension {}", shell_quote(extension)))
}

fn valid_session_id(session_id: &str) -> bool {
    (6..=128).contains(&session_id.len())
        && session_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
}

fn shell_command(program: PtyProgram<'_>, shell: &str) -> Result<String> {
    let shell = shell_quote(shell);
    Ok(match program {
        PtyProgram::NewSession(extension) => {
            format!("{}; exec {shell} -l", omp_command(extension)?)
        }
        PtyProgram::Resume {
            session_id,
            extension,
        } => {
            anyhow::ensure!(
                valid_session_id(session_id),
                "invalid OMP session identifier"
            );
            format!(
                "{} --resume {}; exec {shell} -l",
                omp_command(extension)?,
                shell_quote(session_id)
            )
        }
        PtyProgram::Shell => format!("exec {shell} -l"),
    })
}

// ─── Manager ──────────────────────────────────────────────────────────────

/// Thread-safe PTY cache: `tab_id → PtySession`.
pub struct PtyManager {
    sessions: Mutex<HashMap<String, PtySession>>,
    /// Insertion order for LRU eviction (front = oldest).
    lru: Mutex<Vec<String>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            lru: Mutex::new(Vec::new()),
        }
    }

    // ── Spawn ──────────────────────────────────────────────────────────────

    /// Spawn a new PTY process for `tab_id`, running the selected program in
    /// the requested working directory.
    ///
    /// `on_output(tab_id, base64_chunk)` is called from a background thread
    /// with each output chunk. An **empty chunk** signals process exit.
    pub fn spawn<F>(
        &self,
        tab_id: String,
        program: PtyProgram<'_>,
        cwd: &str,
        size: (u16, u16),
        shell: &str,
        on_output: F,
    ) -> Result<()>
    where
        F: Fn(String, String) + Send + 'static,
    {
        let (cols, rows) = size;
        let cwd = std::fs::canonicalize(cwd).context("resolve PTY working directory")?;
        anyhow::ensure!(cwd.is_dir(), "PTY working directory is not a directory");
        let shell = std::fs::canonicalize(shell).context("resolve login shell")?;
        anyhow::ensure!(shell.is_file(), "login shell is not a regular file");
        let shell = shell.to_string_lossy();

        info!("spawning PTY");

        let pty_system = native_pty_system();
        let size = PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        };
        let pair = pty_system.openpty(size).context("openpty")?;

        let cmd_str = shell_command(program, &shell)?;

        let mut cmd = CommandBuilder::new(shell.as_ref());
        cmd.args(["-l", "-c", &cmd_str]);
        cmd.cwd(cwd);

        let child = pair.slave.spawn_command(cmd).context("spawn PTY child")?;
        let master = pair.master;
        let writer = master.take_writer().context("take PTY writer")?;
        let mut reader = master.try_clone_reader().context("clone PTY reader")?;

        let tid = tab_id.clone();
        std::thread::spawn(move || {
            debug!("PTY reader thread started");
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) | Err(_) => {
                        info!("PTY process exited");
                        on_output(tid.clone(), String::new()); // empty = exit signal
                        break;
                    }
                    Ok(n) => {
                        on_output(tid.clone(), B64.encode(&buf[..n]));
                    }
                }
            }
        });

        let session = PtySession {
            writer,
            child,
            size,
            master,
        };
        self.evict_if_full();
        self.sessions.lock().insert(tab_id.clone(), session);
        self.touch(&tab_id);
        info!("PTY spawned");
        Ok(())
    }

    // ── I/O ───────────────────────────────────────────────────────────────

    /// Write raw input bytes (keyboard / paste) to the PTY for `tab_id`.
    pub fn write(&self, tab_id: &str, data: &[u8]) -> Result<()> {
        let mut sessions = self.sessions.lock();
        let session = sessions
            .get_mut(tab_id)
            .with_context(|| format!("PTY not found: {tab_id}"))?;
        session.writer.write_all(data).context("write PTY")?;
        drop(sessions);
        self.touch(tab_id);
        Ok(())
    }

    /// Resize the PTY (triggers SIGWINCH on Unix).
    pub fn resize(&self, tab_id: &str, cols: u16, rows: u16) -> Result<()> {
        let mut sessions = self.sessions.lock();
        let session = sessions
            .get_mut(tab_id)
            .with_context(|| format!("PTY not found: {tab_id}"))?;
        let size = PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        };
        session.master.resize(size).context("resize PTY")?;
        session.size = size;
        debug!("PTY resized to {cols}x{rows}");
        Ok(())
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────

    /// Kill a PTY process and remove it from the cache.
    /// Safe to call even if the process has already exited.
    pub fn kill(&self, tab_id: &str) {
        if let Some(mut session) = self.sessions.lock().remove(tab_id) {
            if session.child.kill().is_err() {
                warn!("PTY termination reported an error");
            } else {
                info!("PTY killed");
            }
        }
        self.lru.lock().retain(|id| id != tab_id);
    }

    /// Terminate every child process before the desktop application exits.
    pub fn kill_all(&self) {
        let ids: Vec<String> = self.sessions.lock().keys().cloned().collect();
        for id in ids {
            self.kill(&id);
        }
    }
    /// Returns `true` if a live PTY process exists for `tab_id`.
    pub fn has(&self, tab_id: &str) -> bool {
        self.sessions.lock().contains_key(tab_id)
    }

    // ── LRU helpers ───────────────────────────────────────────────────────

    fn touch(&self, tab_id: &str) {
        let mut lru = self.lru.lock();
        lru.retain(|id| id != tab_id);
        lru.push(tab_id.to_string());
    }

    fn evict_if_full(&self) {
        let oldest = {
            let lru = self.lru.lock();
            if lru.len() >= PTY_CACHE_SIZE {
                lru.first().cloned()
            } else {
                None
            }
        };
        if let Some(id) = oldest {
            warn!("PTY cache full — evicting least recently used process");
            self.kill(&id);
        }
    }
}

impl Default for PtyManager {
    fn default() -> Self {
        Self::new()
    }
}

impl Drop for PtyManager {
    fn drop(&mut self) {
        self.kill_all();
    }
}
#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::{shell_command, valid_session_id, PtyProgram};

    #[test]
    fn shell_program_opens_login_shell_without_omp() {
        let command = shell_command(PtyProgram::Shell, "/bin/zsh").unwrap();
        assert_eq!(command, "exec '/bin/zsh' -l");
        assert!(!command.contains("omp"));
    }

    #[test]
    fn resume_rejects_shell_syntax_in_session_id() {
        let extension = Path::new("/Applications/OMPX.app/Contents/Resources/ompx-status.js");
        assert!(valid_session_id("019ffe5e-3e7e-7000-a243-ccce1998a378"));
        assert!(shell_command(
            PtyProgram::Resume {
                session_id: "abc; touch /tmp/pwned",
                extension,
            },
            "/bin/zsh"
        )
        .is_err());
        assert!(shell_command(
            PtyProgram::Resume {
                session_id: "$(whoami)",
                extension,
            },
            "/bin/zsh"
        )
        .is_err());
    }

    #[test]
    fn omp_program_loads_status_extension() {
        let extension = Path::new("/tmp/ompx status.js");
        let command = shell_command(PtyProgram::NewSession(extension), "/bin/zsh").unwrap();
        assert_eq!(
            command,
            "omp --extension '/tmp/ompx status.js'; exec '/bin/zsh' -l"
        );
    }
}
