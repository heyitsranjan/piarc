# Releasing OMPX for macOS

Public releases are universal, Developer ID signed, Apple notarized, stapled, checksumed, and created as drafts for maintainer review.

## One-time setup

1. Join the Apple Developer Program and create a **Developer ID Application** certificate.
2. Export the certificate and private key from Keychain Access as a password-protected `.p12`.
3. Enable GitHub private vulnerability reporting and create a protected `release` environment.
4. Add these GitHub environment secrets:

| Secret | Value |
|---|---|
| `APPLE_CERTIFICATE` | Base64-encoded `.p12` bytes (`base64 -i certificate.p12 | pbcopy`) |
| `APPLE_CERTIFICATE_PASSWORD` | Export password for the `.p12` |
| `APPLE_SIGNING_IDENTITY` | Full Developer ID Application identity |
| `APPLE_ID` | Apple account used for notarization |
| `APPLE_PASSWORD` | App-specific password for that Apple account |
| `APPLE_TEAM_ID` | Ten-character Apple Developer Team ID |

Require reviewer approval on the `release` environment. Never add credentials to repository variables, workflow files, artifacts, or logs.

## Branch protection

Protect `main` with pull requests, one approving review, conversation resolution, linear history, and required checks:

- `Version consistency`
- `Frontend`
- `Rust`
- `Unsigned app smoke build`

Disallow force pushes and branch deletion. Restrict direct pushes to emergency maintainers.

Create a tag ruleset for `v*.*.*` that restricts creation and deletion to release maintainers and blocks tag updates. The workflow independently rejects lightweight tags, tags without a GitHub-verified signature, and tags whose commit is not on `main`.

## Cut a release

1. Update `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` to the same SemVer value.
2. Move the changelog entries from **Unreleased** to a dated release section.
3. Merge the release pull request after all required checks pass.
4. Create and push the signed tag:

   ```bash
   git tag -s v0.1.0 -m "OMPX v0.1.0"
   git push origin v0.1.0
   ```

5. Approve the protected GitHub `release` environment.
6. Inspect the draft release. Confirm its DMG and `SHA256SUMS.txt`, download the DMG to a clean Mac, install it, and exercise launch, hide/restore, OMP detection, session resume, terminal close, and Quit.
7. Publish the draft only after Gatekeeper accepts the downloaded artifact.

## Failure policy

Do not bypass signing, notarization, version, or validation failures. Delete a failed draft, fix the source or credential configuration through a pull request, and create a new patch version/tag if the tag was already published externally. Tags remain immutable.

## Credential rotation

Rotate the app-specific password and exported certificate when a maintainer leaves, a secret may have leaked, or Apple revokes the certificate. Revoke compromised credentials before rerunning the workflow.
