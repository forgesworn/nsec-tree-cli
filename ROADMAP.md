# Roadmap

## Vision

Make `nsec-tree-cli` the best offline-first developer experience for hierarchical
Nostr identity.

The CLI should feel immediately useful, safe, and teach the model through real
commands and real outputs.

## Phase 1 — Strong foundation

- standalone repo and package
- clear mission and CLI spec
- working command parser
- root create / restore / import-nsec
- path derivation
- export of `npub` / `nsec` / full identity record
- proof generation and verification
- Shamir split and recovery
- local profile storage
- `--json` and human-readable output

## Phase 2 — Developer wow

- more polished human output formatting
- explicit “why this matters” onboarding examples
- richer `inspect` and `explain` output
- better error wording and command suggestions
- end-to-end demo flows in docs
- stable JSON schemas documented per command

## Phase 3 — Operator workflows

- QR-oriented secret and share export
- profile metadata and labels
- safer root-file conventions
- import/export bundles for offline workflows
- shell completion
- man page / generated reference docs

## Phase 4 — Advanced integrations

- publishable proof artifacts
- richer signed output formats
- companion examples for air-gapped flows
- integration examples with other ForgeSworn tools

## Non-goals for now

- relay publishing
- network-dependent default flows
- wallet-style GUI behavior
- hidden magic state as the primary UX
- re-implementing crypto already owned by `nsec-tree` or `shamir-words`
