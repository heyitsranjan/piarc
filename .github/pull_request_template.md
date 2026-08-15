## Problem

<!-- What observable problem does this solve? Link the issue. -->

Closes #

## Change

<!-- Describe the smallest implementation and any trust-boundary decision. -->

## Verification

- [ ] `bun run validate`
- [ ] Changed desktop workflow exercised in `bun run tauri dev`
- [ ] Packaged app exercised when bundle, entitlement, permission, or release behavior changed

Evidence:

## Risk and privacy

- [ ] No new filesystem, process, IPC, network, logging, or macOS permission exposure
- [ ] Exposure is described below and includes denial/revocation behavior

<!-- Remove the inapplicable checkbox and explain any exposure. -->

## Contributor checks

- [ ] Focused change; no unrelated formatting or generated artifacts
- [ ] Tests cover new observable behavior or the PR explains why no test applies
- [ ] Documentation and changelog updated when user-facing behavior changed
- [ ] Contribution may be distributed under the repository's MIT License
