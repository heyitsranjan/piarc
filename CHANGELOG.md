# Changelog

All notable changes to Oh My Pi are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial scaffold: Tauri v2 + React 19 + TypeScript + Vite + Tailwind v4
- Session browser sidebar with search, pin, delete, and context menu
- Embedded xterm.js WebGL terminal with PTY via `portable-pty`
- LRU PTY cache (8 slots) for instant tab switching
- Pre-warming of top 3 sessions on launch
- Multi-tab terminal: ⌘T / ⌘W / ⌘1-9 shortcuts
- Command palette: ⌘K fuzzy search
- All async states handled: initial / loading / error / empty / data
- Structured logging: `tauri-plugin-log` → platform log file + DevTools
- Formatters: Prettier + `@trivago/prettier-plugin-sort-imports`
- Linter: ESLint v9 flat config
- Rust: `rustfmt.toml`, `cargo clippy`
- Pre-commit hooks via `lefthook`
- CI: GitHub Actions (frontend + Rust cross-platform)
- Release workflow: Tauri bundle on tag push
