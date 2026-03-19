# Architecture

`nsec-tree-cli` is the application layer above two focused libraries.

## Libraries

- `nsec-tree`
  - root creation from mnemonic or nsec
  - deterministic derivation
  - child export
  - continuity proofs
  - encoding helpers

- `shamir-words`
  - secret splitting and reconstruction
  - human-friendly share encoding

## CLI responsibilities

- command grammar
- human output
- `--json` output
- profile storage
- filesystem input/output
- safe secret warnings
- explain/inspect onboarding flows

## Design rule

If logic is generally useful to applications, it belongs in a library.

If logic is about developer/operator experience in a terminal, it belongs in the
CLI.
