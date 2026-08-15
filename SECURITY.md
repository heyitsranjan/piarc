# Security policy

## Supported versions

| Version | Supported |
|---|---|
| Latest GitHub release | Yes |
| Older releases and development snapshots | No |

## Report a vulnerability

Do not disclose vulnerabilities in a public issue, discussion, pull request, or log attachment.

Use **Security → Report a vulnerability** in the [GitHub repository](https://github.com/ranjan-hackerrank/ompx/security/advisories/new). Include:

- affected OMPX version and macOS version;
- reproduction steps or a minimal proof of concept;
- observed impact and required user interaction;
- whether session data, filesystem paths, PTY execution, IPC, or macOS permissions are involved;
- suggested remediation, if known.

The maintainer will acknowledge a complete report within 7 days, provide a triage decision within 14 days, and coordinate disclosure after a fix is available. Please allow 90 days before public disclosure unless both parties agree otherwise.

## Scope priorities

High-priority reports include arbitrary command execution, path traversal outside OMP session storage, unsafe session mutation, WebView-to-native IPC bypass, secret or terminal-content leakage, and unintended macOS permission use.

Reports that require a user to intentionally run untrusted code in an already-authorized terminal are generally out of scope unless OMPX increases the resulting privilege or exposure.
