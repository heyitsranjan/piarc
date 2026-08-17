# Changelog

All notable changes to PiArc are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

## [0.1.0-dev.1] - 2026-08-16

### Added

- Developer Preview source installation through `./scripts/dev-preview`.
- Local-first browser for OMP JSONL sessions with search, pin, rename, and confirmed deletion.
- Embedded multi-tab xterm.js terminals backed by native PTYs.
- Project explorer, installed-editor launcher, Git status, and unified diff review.
- OMP installation and login-path prerequisite detection.
- Explicit macOS Automation, Accessibility, and Screen Recording controls.
- Menu-bar access, native completion notifications, and nonblocking OMP update controls.
- Contributor, security, conduct, issue, and pull-request guidance.

### Security

- Restricted session deletion and rename to regular JSONL files in the canonical OMP sessions tree.
- Rejected shell syntax in OMP session identifiers and canonicalized PTY working directories and shells.
- Added a restrictive production Content Security Policy.
- Redacted user content and local identifiers from frontend production logs.

[0.1.0-dev.1]: https://github.com/heyitsranjan/piarc/releases/tag/v0.1.0-dev.1
