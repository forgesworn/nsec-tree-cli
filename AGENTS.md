## Purpose

`nsec-tree-cli` is the standalone command-line application for hierarchical
Nostr identity workflows.

This repo owns:

- command grammar
- help and onboarding UX
- human-readable and `--json` output
- profile storage
- filesystem input and output
- safety warnings for sensitive material

This repo does **not** own the core cryptographic primitives.

Those belong in sibling libraries:

- `nsec-tree`
- `shamir-words`

## Architecture rules

- Keep `nsec-tree-cli` as the application layer.
- Reuse `nsec-tree` for derivation, export, proofs, and identity semantics.
- Reuse `shamir-words` for Shamir splitting and recovery workflows.
- Do not re-implement cryptographic logic in the CLI when it can live in a library.
- If logic becomes broadly reusable, move it into the appropriate library instead.

## Product rules

- The CLI must stay offline-first.
- Human mode should be concise and explanatory.
- `--json` output should be stable and scriptable.
- Sensitive commands must warn clearly in TTY mode.
- Always preserve the distinction between:
  - `nsec-backed root`
  - `mnemonic-backed root`

## Messaging rules

The CLI should consistently teach:

- both root types can derive the tree
- only mnemonic-backed roots support phrase / Shamir recovery
- derived children are standalone Nostr identities
- proofs are optional and selective

Prefer these phrases in user-facing text:

- `private proof`
- `full proof`
- `nsec-backed root`
- `mnemonic-backed root`

## Development rules

- Keep dependencies minimal.
- Prefer simple Node.js and library reuse over framework-heavy abstractions.
- Keep commands deterministic where possible.
- Avoid hidden global state; explicit input beats magic.
- Profile storage is a convenience layer, not a required mode.
