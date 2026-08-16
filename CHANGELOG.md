# Changelog

All notable changes to OMPX are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed

- Prompt for a working directory during creation instead of exposing a persistent bottom-bar folder control.

## [0.1.0] - 2026-08-15

### Added

- Local-first browser for OMP JSONL sessions with search, pin, rename, and confirmed deletion.
- Embedded multi-tab xterm.js terminals backed by an eight-process native PTY cache.
- Disconnected terminal metadata restoration after application relaunch.
- Project explorer, installed-editor launcher, Git status, and unified diff review.
- Filesystem watcher for live session updates.
- OMP installation and login-path prerequisite detection.
- Just-in-time macOS Automation, Accessibility, and Screen Recording status interface.
- Menu bar hide, restore, and explicit quit behavior.
- macOS signing, notarization, universal-binary, draft-release, and checksum workflow.
- Contributor, security, conduct, issue, and pull-request guidance.

### Security

- Restricted session deletion and rename to regular JSONL files in the canonical OMP sessions tree.
- Rejected shell syntax in OMP session identifiers and canonicalized PTY working directories and shells.
- Removed unused shell, opener, and updater WebView plugins and permissions.
- Added a restrictive production Content Security Policy.
- Redacted user content and local identifiers from frontend production logs.
- Added explicit macOS privacy descriptions and Apple Events entitlement.

### Changed

- Renamed the desktop product to OMPX with bundle identifier `com.heyitsranjan.ompx`.
- Set the minimum supported operating system to macOS 12.
- Closing the main window hides OMPX; Quit terminates child PTYs.

### Removed

- Disconnected launch-time PTY prewarming.
- Unsupported Windows and Linux release claims.
- Incomplete automatic updater configuration.

[Unreleased]: https://github.com/ranjan-hackerrank/ompx/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ranjan-hackerrank/ompx/releases/tag/v0.1.0
