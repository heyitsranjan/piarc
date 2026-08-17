# PiArc

Native, local-first macOS companion for [Oh My Pi](https://omp.sh) sessions.

> **Developer Preview** — run PiArc from source on macOS. PiArc is an unofficial community project and is not affiliated with Oh My Pi.

PiArc discovers local OMP sessions, resumes them in embedded terminals, surfaces project and Git context, and provides explicit controls for approved macOS integrations.

## Requirements

- macOS 12 or newer, Apple Silicon or Intel
- Git
- [Xcode Command Line Tools](https://developer.apple.com/xcode/resources/)
- [Bun](https://bun.sh) 1.3.12
- [Rust stable](https://rustup.rs)
- [Oh My Pi](https://omp.sh) for session discovery and resume

Ghostty, iTerm2, and Terminal.app are supported for opening resumed sessions.

## Run locally

```bash
git clone https://github.com/heyitsranjan/piarc.git
cd piarc
./scripts/dev-preview
```

The launcher verifies prerequisites, installs locked dependencies, then starts the native desktop app. It does not install Bun, Rust, Xcode Command Line Tools, or OMP automatically.

## OMP setup

PiArc starts without OMP, but session browsing and resume require a local OMP installation. When OMP is missing, PiArc shows the official install command and lets you recheck afterwards:

```bash
curl -fsSL https://omp.sh/install | sh
```

## Features

- Recency-sorted OMP session browser with search, pin, rename, and confirmed deletion
- Embedded multi-tab xterm.js terminal backed by native PTYs
- Live session refresh through a filesystem watcher
- Project explorer, Git status, and unified diff review
- Explicit macOS Automation, Accessibility, and Screen Recording controls
- Menu-bar access, dark/light themes, native completion notifications, and nonblocking OMP updates

## Privacy and permissions

PiArc reads local OMP session metadata and interacts with local terminal tools. It does not upload OMP session content, source code, credentials, or telemetry.

Launching PiArc needs no privacy permission. Controlling another application may require Automation or Accessibility; inspecting screen pixels requires Screen Recording. PiArc explains the requested capability before opening the macOS prompt or System Settings.

PiArc does not request Input Monitoring, Full Disk Access, camera, or microphone access.

## Known limitations

- macOS only
- Developer Preview: source-based installation only
- No signed or notarized application bundle yet
- OMP is installed and updated separately

## Development

Run the complete local gate:

```bash
bun run validate
```

Build an unsigned local application bundle:

```bash
bun run tauri build --bundles app
```

## Contributing

Report bugs and feature requests through [GitHub Issues](https://github.com/heyitsranjan/piarc/issues). Submit code changes through [pull requests](https://github.com/heyitsranjan/piarc/pulls).

Bug reports must include PiArc version, macOS version, CPU architecture, OMP version, expected behavior, actual behavior, and sanitized reproduction evidence. See [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © 2026 Smruti Ranjan Rana
