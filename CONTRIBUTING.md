# Contributing to PiArc

Thank you for improving PiArc. Keep changes focused, local-first, and safe at filesystem, process, and macOS permission boundaries.

## Setup

```bash
git clone https://github.com/heyitsranjan/piarc.git
cd piarc
./scripts/dev-preview
```

Requirements: macOS 13+, Rust stable, Bun 1.3.12, and Xcode Command Line Tools. OMP is required for end-to-end session testing.

## Workflow

1. Search existing issues before opening a focused issue for a feature or behavior change.
2. Fork the repository and create a focused branch, such as `fix/session-path-check`.
3. Add the smallest behavioral test that fails without the change.
4. Run `bun run validate`.
5. Exercise affected desktop behavior through `./scripts/dev-preview`.
6. Open a pull request using the template and include verification evidence.

## Code standards

- TypeScript stays strict; do not call `invoke()` outside `src/lib/ipc.ts`.
- Rust Tauri commands remain thin; business logic belongs in `src-tauri/src/services/`.
- Validate paths, identifiers, and process arguments at native trust boundaries.
- Never add arbitrary shell or AppleScript execution endpoints.
- New macOS privacy access requires purpose-specific consent UI, denial handling, and tests.
- Never log prompts, terminal bytes, tokens, commands, session identifiers, or full paths.
- Handle loading, empty, error, denied, and revoked states at async or permission boundaries.

## Validation

```bash
bun run validate
```

This runs TypeScript type checking, ESLint, Prettier verification, Rust formatting, Clippy with warnings denied, and Rust unit tests.

For release-affecting changes, also run:

```bash
bun run build
bun run tauri build --bundles app
```

## Commit format

Use Conventional Commits:

```text
<type>(<scope>): <imperative summary>
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

## Pull-request expectations

- One coherent change.
- No unrelated formatting or generated artifacts.
- Tests defend observable behavior, not source text.
- UI changes include a screenshot or concise interaction evidence.
- Security-sensitive changes explain the trust boundary and denial behavior.
- Contributions are distributed under the MIT License.

## Reporting vulnerabilities

Do not open public issues for vulnerabilities. Follow [SECURITY.md](SECURITY.md) and use GitHub private vulnerability reporting.
