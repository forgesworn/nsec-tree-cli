# CLI Spec

## Product goals

The CLI should feel like more than a thin wrapper around functions.

A developer should quickly see:

- one root -> many identities
- unlinkability by default
- optional continuity proofs
- offline-first operation
- human-usable recovery workflows

## Principles

- offline-first by default
- no network required for core operations
- human-readable output by default
- `--json` for scripting
- safe handling of secrets
- clear distinction between root types
- minimal ceremony for first success

## Mental model

- **Root** — starting secret for derivation
- **Persona** — named branch of identity
- **Account** — derived child identity for a specific use
- **Private proof** — proves shared root without revealing derivation context
- **Full proof** — proves shared root and reveals derivation context
- **Mnemonic-backed root** — recoverable with phrase / Shamir
- **nsec-backed root** — derivation-capable, but not phrase-recoverable

## Top-level commands

- `nsec-tree root`
- `nsec-tree derive`
- `nsec-tree export`
- `nsec-tree prove`
- `nsec-tree verify`
- `nsec-tree shamir`
- `nsec-tree profile`
- `nsec-tree inspect`
- `nsec-tree explain`

## Root commands

- `nsec-tree root create`
- `nsec-tree root restore`
- `nsec-tree root import-nsec`
- `nsec-tree root inspect`

Expected output should make these explicit:

- root type
- recoverable yes/no
- master pubkey / npub
- warnings when relevant

## Derivation commands

- `nsec-tree derive path <path>`
- `nsec-tree derive persona <name>`
- `nsec-tree derive account <path>`

Canonical path syntax:

- `personal`
- `personal/forum-burner`
- `personal@1/forum-burner@3`

Rules:

- `/` separates levels
- `@index` is optional, default `0`
- names are lowercase, shell-friendly, max 32 chars

## Export commands

- `nsec-tree export npub <path>`
- `nsec-tree export nsec <path>`
- `nsec-tree export identity <path>`

Secret-emitting commands should warn in TTY mode and support:

- `--json`
- `--quiet`
- `--out`

## Proof commands

- `nsec-tree prove private <path>`
- `nsec-tree prove full <path>`
- `nsec-tree verify proof <file>`
- `nsec-tree verify proof --stdin`

Use `private` rather than `blind` in user-facing command language.

## Shamir commands

- `nsec-tree shamir split`
- `nsec-tree shamir recover`

Important rule:

- Shamir operates on mnemonic recovery material
- it does not upgrade a plain imported `nsec` into a recovery-capable root

## Profiles

Profiles are a CLI convenience layer, not hidden magic.

- `nsec-tree profile save <name>`
- `nsec-tree profile list`
- `nsec-tree profile use <name>`
- `nsec-tree profile show [name]`
- `nsec-tree profile remove <name>`

Explicit root input remains the default-safe path for scripts.

## Inspect and explain

- `nsec-tree inspect path <path>`
- `nsec-tree inspect root`
- `nsec-tree explain model`
- `nsec-tree explain proofs`
- `nsec-tree explain recovery`

These commands are onboarding tools and part of the wow factor.

## Must-have v1

- `root create`
- `root restore`
- `root import-nsec`
- `derive path`
- `export npub`
- `export nsec`
- `prove private`
- `prove full`
- `verify proof`
- `shamir split`
- `shamir recover`
- `--json`

## Nice-to-have

- `profile` commands
- `inspect` commands
- `explain` commands
- QR-oriented output

## Example wow flow

```bash
nsec-tree root create
nsec-tree derive path personal
nsec-tree derive path anon/forum-burner
nsec-tree export nsec anon/forum-burner
nsec-tree prove private anon/forum-burner
```
