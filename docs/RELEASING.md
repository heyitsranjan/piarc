# Releasing PiArc for macOS

PiArc Developer Preview releases are source-based. Signed application bundles, notarized DMGs, and Homebrew packaging begin at the beta stage.

## Developer Preview

1. Confirm `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` use the same prerelease SemVer value.
2. Run the local validation gate:

   ```bash
   bun run validate
   bun run build
   ```

3. Create and push an annotated prerelease tag:

   ```bash
   git tag -a v0.1.0-dev.1 -m "PiArc developer preview 1"
   git push origin v0.1.0-dev.1
   ```

4. Create a GitHub prerelease with source installation instructions:

   ```bash
   git clone https://github.com/heyitsranjan/piarc.git
   cd piarc
   ./scripts/dev-preview
   ```

Developer Preview releases must not claim Apple signing, notarization, or production-support status.

## Beta and stable release prerequisites

Before shipping a downloadable PiArc application:

1. Join the Apple Developer Program and create a **Developer ID Application** certificate.
2. Enable GitHub private vulnerability reporting and create a protected `release` environment.
3. Add GitHub environment secrets for the signing certificate, identity, Apple ID, app-specific password, and Apple Team ID.
4. Build universal binaries, sign, notarize, staple, and test on a clean Mac with Gatekeeper enabled.
5. Publish only after validation, app launch, OMP detection, session resume, and terminal behavior are verified.

Do not bypass signing, notarization, version, or validation failures for signed releases.
