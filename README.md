# nsec-tree-cli

Offline-first developer tooling for hierarchical Nostr identity.

This repository is the command-line application layer for:

- `nsec-tree` — root creation, deterministic derivation, export, proofs
- `shamir-words` — human-friendly Shamir splitting and recovery

The goal is to make the `nsec-tree` model feel obvious, useful, and scriptable
in a few commands — even with no network access.

## Why its own project?

The CLI has different responsibilities from the libraries:

- command parsing
- profile storage
- TTY warnings
- file I/O
- human-readable output
- JSON output for scripts
- future UX features like QR or recovery helpers

Keeping the CLI separate lets:

- `nsec-tree` stay a focused library
- `shamir-words` stay a focused library
- `nsec-tree-cli` iterate quickly on developer UX

## Current status

This repo now contains the actual CLI implementation alongside the product docs.
The command surface is defined in `CLI-SPEC.md`.

## Planned command groups

- `nsec-tree root`
- `nsec-tree derive`
- `nsec-tree export`
- `nsec-tree prove`
- `nsec-tree verify`
- `nsec-tree shamir`
- `nsec-tree profile`
- `nsec-tree inspect`
- `nsec-tree explain`

## Local development

```bash
node ./bin/nsec-tree.js --help
node --test
```

The CLI resolves dependencies in this order:

- installed packages (`nsec-tree`, `@forgesworn/shamir-words`)
- local sibling workspaces in `../nsec-tree` and `../shamir-words`

That makes it usable immediately in this multi-repo workspace while still
matching the future published package layout.

## First wow flow

```bash
nsec-tree root create
nsec-tree derive path personal
nsec-tree derive path anon/forum-burner
nsec-tree export nsec anon/forum-burner
nsec-tree prove private anon/forum-burner
```

This is the core story the CLI should make obvious:

- one root
- many unlinkable identities
- optional continuity proofs
- fully offline-capable workflows

## Planning docs

- `MISSION.md`
- `ARCHITECTURE.md`
- `CLI-SPEC.md`
- `ROADMAP.md`
- `TODO.md`
