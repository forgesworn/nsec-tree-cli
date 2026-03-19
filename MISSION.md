# Mission

Build the best offline-first developer tooling for hierarchical Nostr identity.

`nsec-tree-cli` exists to make Nostr keys feel programmable, composable, and
safe to operate. A developer should be able to start from a single root secret,
derive many unlinkable identities, selectively prove continuity when needed,
back up recovery material safely, and do it all without depending on relays,
wallet UX, or web services.

## What makes this worth doing?

Today, most Nostr usage treats a private key as a single account.

That works, but it leaves real needs awkward:

- separating identities across contexts
- creating burner accounts without key sprawl
- rotating identities while proving continuity
- handling backups in a human-usable way
- scripting identity workflows offline

`nsec-tree-cli` makes those workflows first-class.

## Core truths the CLI must teach

- one root can derive many real Nostr identities
- those identities are unlinkable by default
- derived children are usable standalone `nsec` / `npub` pairs
- continuity proofs are optional and selective
- core workflows work fully offline

## Root model

Both root types can derive the hierarchy:

- **nsec-backed root**
  - can derive personas/accounts/tree
  - can export children
  - can generate proofs
  - cannot do phrase/Shamir recovery by itself

- **mnemonic-backed root**
  - can derive personas/accounts/tree
  - can export children
  - can generate proofs
  - can do phrase backup
  - can do Shamir splitting of that phrase

The difference is recovery, not tree capability.

## How this differs from existing Nostr approaches

Most NIPs and clients focus on:

- login
- signing
- transport
- encryption
- application behaviour

Those are important, but they do not define an offline-first hierarchy for
derived Nostr identities with selective continuity proofs and human-usable
recovery workflows.

This project focuses on a different layer:

- how one root becomes many identities
- how those identities stay unlinkable by default
- how continuity can be proven only when needed
- how recovery can be done in a practical human workflow

## Success test

We are succeeding when a developer can do this in under five minutes:

- create or import a root
- derive multiple personas/accounts
- export a usable child `nsec`
- understand the difference between nsec-backed and mnemonic-backed roots
- generate a private continuity proof
- understand why the whole system works offline
