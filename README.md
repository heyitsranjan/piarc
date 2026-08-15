# OMPX

A lightweight, local-first macOS desktop companion for [OMP](https://omp.sh). Browse recent sessions, resume them in embedded terminals, inspect project files and Git changes, and explicitly manage macOS permissions used by approved automation actions.

## Requirements

- macOS 12 or newer
- Apple Silicon or Intel Mac
- [OMP](https://omp.sh) installed in the login-shell `PATH`

OMPX stores no cloud account and sends no telemetry. Session data remains in OMP's existing `~/.omp/agent/sessions/` directory. OMPX persists only interface preferences and disconnected terminal metadata in the local WebView profile.

## Features

- Recency-sorted OMP session browser with search, pin, rename, and confirmed deletion
- Embedded multi-tab xterm.js terminal backed by native PTYs
- Live session refresh through a filesystem watcher
- Restored terminal metadata after relaunch; processes reconnect only when selected
- Project explorer, Git status, and unified diff review
- Installed-editor launcher with an explicit editor allowlist
- Just-in-time macOS Automation, Accessibility, and Screen Recording controls
- Menu bar access with deterministic hide, restore, and quit behavior
- Dark and light themes

## Install

Download the signed and notarized DMG from [GitHub Releases](https://github.com/ranjan-hackerrank/ompx/releases), open it, and drag **OMPX** into Applications.

Release builds are not published until Apple signing and notarization checks pass. Until the first public release, build from source.

## Development

### Prerequisites

- [Rust stable](https://rustup.rs)
- [Bun](https://bun.sh) 1.3.12
- Xcode Command Line Tools
- OMP for end-to-end session testing

```bash
git clone https://github.com/ranjan-hackerrank/ompx.git
cd ompx
bun install --frozen-lockfile
bun run hooks:install
bun run tauri dev
```

Run the complete local gate:

```bash
bun run validate
```

Build an unsigned local application bundle:

```bash
bun run tauri build --bundles app
```

## Privacy and permissions

Launching an application normally requires no privacy permission. Controlling another application may require Automation or Accessibility; inspecting screen pixels requires Screen Recording. OMPX explains the requested capability before opening the macOS prompt or System Settings. Permissions remain revocable under **System Settings → Privacy & Security**.

OMPX does not request Input Monitoring, Full Disk Access, camera, or microphone access. If a future feature needs one, that change requires a separate security review and purpose-specific consent.

## Architecture

- `src/` — React/TypeScript interface, Zustand state, xterm integration
- `src-tauri/src/commands/` — thin typed IPC handlers
- `src-tauri/src/services/` — session, PTY, Git, editor, permission, and watcher logic
- `src-tauri/capabilities/` — explicit Tauri WebView capabilities
- `.github/workflows/` — CI and draft macOS release automation

Trust-boundary rules:

- Destructive session operations accept only regular `.jsonl` files directly under the canonical OMP sessions tree.
- PTY session identifiers and working directories are validated before process creation.
- Editor and application launches use allowlisted identifiers, never arbitrary shell snippets from the WebView.
- Production logs redact paths, commands, prompts, session identifiers, terminal data, and tokens.

## Logs

macOS logs are stored under:

```text
~/Library/Logs/com.heyitsranjan.ompx/ompx.log
```

Logs contain operational metadata only. Do not attach logs publicly without reviewing them.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [SECURITY.md](SECURITY.md). Bug reports and pull requests must use the repository templates.

## License

[MIT](LICENSE) © 2026 Smruti Ranjan Rana.
