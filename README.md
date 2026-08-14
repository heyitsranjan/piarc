# Oh My Pi

> A lightweight cross-platform desktop companion for [omp (Oh My Pi)](https://omp.sh) —
> browse recent sessions, resume them instantly in an embedded terminal.

Built with **Tauri v2 + React 19 + TypeScript + Tailwind v4**.
Design tokens sourced directly from [omp.sh](https://omp.sh).

---

## Features

| Feature | Description |
|---|---|
| **Session browser** | Sidebar lists all `~/.omp/agent/sessions/` sessions sorted by recency |
| **Live refresh** | FS watcher auto-updates the list when new sessions appear |
| **Embedded terminal** | xterm.js + WebGL renderer + PTY via `portable-pty` |
| **Terminal cache** | LRU cache of 8 live PTY processes — switching tabs is instant |
| **Pre-warming** | Top 3 sessions spawned on launch so first click is immediate |
| **Multi-tab** | ⌘T new tab · ⌘W close · ⌘1-9 switch |
| **Command palette** | ⌘K fuzzy search across all sessions |
| **Pin / delete** | Pin sessions to the top · delete from disk |
| **Dark / light** | Follows system; toggle in settings |
| **Cross-platform** | macOS · Windows · Linux |

## Stack

| Layer | Technology |
|---|---|
| Shell | [Tauri v2](https://tauri.app) (Rust) |
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind v4 CSS-first |
| Terminal | [xterm.js](https://xtermjs.org) v5 + WebGL |
| PTY | [portable-pty](https://crates.io/crates/portable-pty) (WezTerm) |
| State | Zustand v5 |
| Logging | `tauri-plugin-log` → platform log file + DevTools |

## Development

### Prerequisites

- [Rust stable](https://rustup.rs)
- [Bun](https://bun.sh) ≥ 1.0
- macOS: Xcode Command Line Tools
- Linux: `libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev`

### Setup

```bash
git clone https://github.com/heyitsranjan/oh-my-pi
cd oh-my-pi
bun install
bun run hooks:install   # install lefthook pre-commit hooks
```

### Run in dev mode

```bash
bun run tauri dev
```

### Validate (typecheck + lint + format)

```bash
bun run validate
```

### Build for production

```bash
bun run tauri build
```

## Log files

| Platform | Location |
|---|---|
| macOS | `~/Library/Logs/com.oh-my-pi.app/oh-my-pi.log` |
| Windows | `%APPDATA%\com.oh-my-pi.app\logs\oh-my-pi.log` |
| Linux | `~/.local/share/com.oh-my-pi.app/logs/oh-my-pi.log` |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Commits must follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(sidebar): add group-by-project toggle
fix(terminal): handle PTY spawn failure gracefully
```

## License

MIT — © 2026 Smruti Ranjan Rana
