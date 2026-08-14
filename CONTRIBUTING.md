# Contributing to Oh My Pi

## Setup

```bash
bun install
bun run hooks:install   # lefthook pre-commit + commit-msg hooks
```

## Workflow

1. Create a branch: `git checkout -b feat/my-feature`
2. Make changes. Hooks auto-format on commit.
3. Run validation: `bun run validate`
4. Open a PR against `main`.

## Commit format

```
<type>(<scope>): <subject>

[optional body — explain WHY, not WHAT]
```

Types: `feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `ci` `chore`

Examples:
```
feat(terminal): add split-pane support
fix(sidebar): prevent flicker on session delete
perf(pty): increase LRU cache size to 12
```

## Code standards

- **TypeScript**: strict mode, no `any` without justification
- **Imports**: sorted by Prettier plugin — run `bun run format` before committing
- **Rust**: `cargo clippy -- -D warnings` must pass; `cargo fmt` must be clean
- **Logging**: use `log` from `@/lib/logger` on the frontend, `tracing` macros in Rust
- **Error states**: every async boundary must handle initial / loading / error / empty / data
- **JSDoc**: required on all exported functions, interfaces, and non-obvious logic

## Scripts

| Command | Purpose |
|---|---|
| `bun run dev` | Start Vite dev server (no Tauri) |
| `bun run tauri dev` | Full Tauri dev mode |
| `bun run validate` | typecheck + lint + format check |
| `bun run format` | Auto-format TypeScript |
| `bun run lint` | ESLint with auto-fix |
| `bun run fmt:rust` | Format Rust |
| `bun run clippy` | Rust linter |
| `bun run test:rust` | Rust unit tests |
