# Contributing to OMPX

Thank you for improving OMPX. Keep changes focused, local-first, and safe at filesystem, process, and macOS permission boundaries.

## Setup

```bash
git clone https://github.com/ranjan-hackerrank/ompx.git
cd ompx
bun install --frozen-lockfile
bun run hooks:install
bun run tauri dev
```

Requirements: macOS 12+, Rust stable, Bun 1.3.12, Xcode Command Line Tools, and OMP for end-to-end terminal testing.

## Workflow

1. Search existing issues and open one for behavior changes larger than a small fix.
2. Fork the repository and create a focused branch such as `fix/session-path-check`.
3. Add the smallest behavioral test that would fail without the change.
4. Run `bun run validate`.
5. Exercise the changed desktop behavior in `bun run tauri dev`.
6. Open a pull request using the template. Link its issue and include verification evidence.

## Code standards

- TypeScript stays strict; avoid `any` and direct `invoke()` calls outside `src/lib/ipc.ts`.
- Rust Tauri commands remain thin; business logic belongs in `src-tauri/src/services/`.
- Validate paths, identifiers, and process arguments at native trust boundaries.
- Do not add arbitrary shell or AppleScript execution endpoints.
- New macOS privacy access requires a usage description, just-in-time consent UI, denial handling, and tests.
- Use `@/lib/logger` in the frontend and `tracing` in Rust. Never log prompts, terminal bytes, tokens, commands, session identifiers, or full paths.
- Handle loading, empty, error, denied, and revoked states at async or permission boundaries.
- Reuse existing components and dependencies before adding abstractions or packages.

## Validation

```bash
bun run validate
```

This runs TypeScript type checking, ESLint, Prettier verification, Rust formatting, Clippy with warnings denied, and Rust unit tests.

For a release-affecting change, also run:

```bash
bun run build
bun run tauri build --bundles app
```

A pull request is not release evidence unless the packaged app was launched and the changed workflow was exercised.

## Commit format

Use Conventional Commits:

```text
<type>(<scope>): <imperative summary>
```

Examples:

```text
fix(sessions): reject paths outside OMP storage
feat(privacy): show screen capture status
ci(release): notarize universal macOS bundle
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

## Pull-request expectations

- One coherent change.
- No unrelated formatting or generated artifacts.
- Tests defend observable behavior, not source text.
- UI changes include a screenshot or concise interaction evidence.
- Security-sensitive changes explain the trust boundary and denial behavior.
- Contributor certifies the contribution is theirs and may be distributed under the MIT License.

## Reporting vulnerabilities

Do not open public issues for vulnerabilities. Follow [SECURITY.md](SECURITY.md) and use GitHub private vulnerability reporting.
