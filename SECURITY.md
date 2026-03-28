# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in nsec-tree-cli, please report it responsibly.

**Email:** thecryptodonkey@proton.me

Please include:

- A description of the vulnerability
- Steps to reproduce
- The version of nsec-tree-cli affected

We aim to acknowledge reports within 48 hours and provide a fix or mitigation plan within 7 days.

## Scope

nsec-tree-cli is the CLI application layer. It delegates all cryptographic operations to:

- [`nsec-tree`](https://www.npmjs.com/package/nsec-tree) -- derivation, proofs, verification
- [`@forgesworn/shamir-words`](https://www.npmjs.com/package/@forgesworn/shamir-words) -- Shamir secret sharing
- [`@scure/bip39`](https://www.npmjs.com/package/@scure/bip39) -- mnemonic generation and validation

If the vulnerability is in one of these libraries, please report it to the relevant maintainer as well.

## Security Model

- All operations run fully offline. No network calls, no DNS lookups, no relay connections, no telemetry.
- Secret files are written with mode `0o600`; directories with `0o700`.
- Mnemonics and nsecs are never logged.
- Suitable for air-gapped hardware.
