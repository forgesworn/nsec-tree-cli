# nsec-tree-cli

**Nostr:** [`npub1mgvlrnf5hm9yf0n5mf9nqmvarhvxkc6remu5ec3vf8r0txqkuk7su0e7q2`](https://njump.me/npub1mgvlrnf5hm9yf0n5mf9nqmvarhvxkc6remu5ec3vf8r0txqkuk7su0e7q2)

```
npx nsec-tree-cli root create
```

One root secret. Unlimited Nostr identities. Fully offline.

`nsec-tree-cli` is a command-line tool for **hierarchical Nostr identity management**, built on the [`nsec-tree`](https://www.npmjs.com/package/nsec-tree) library. It lets you derive as many independent keypairs as you need from a single root secret — like a locksmith cutting unique keys from one master blank. Every derived identity has its own npub and nsec, completely unlinkable to each other, yet all traceable back to your root when you choose to prove it. The entire tool works offline. Your root secret never touches a network.

## See it in action

**Create a root identity** — generates a BIP-39 mnemonic and saves it as a local profile. Write down the mnemonic; it's your recovery path.

```
$ nsec-tree root create --name main

  root type     mnemonic-backed
  recoverable   yes
  master npub   npub1wk7lycqxj5x05thzl59fszlhcmpxe4ya045662skh8elk8zy6rzs6r7hle
  profile       main

  mnemonic      misery robust expire sand reflect stove life
                hold patch electric vessel rebuild

  Store this mnemonic offline. It cannot be recovered.

  Try next:
    nsec-tree derive path personal
    nsec-tree export nsec personal
```

**Derive a purpose-built identity** — slash-separated paths create a tree. Here, `personal` is a category and `forum-burner` is a leaf identity.

```
$ nsec-tree derive path personal/forum-burner --mnemonic "abandon ... about"

  root
     └─ personal@0          npub1nleq...n47ps
        └─ forum-burner@0   npub1fakn...kym592  (leaf)
```

**Export the private key** — when you need to load the derived identity into a Nostr client.

```
$ nsec-tree export nsec personal/forum-burner --mnemonic "abandon ... about"

  path          personal@0/forum-burner@0
  nsec          nsec1gpd5p2chjuqc9jr72hk6sj662x85v23rzv283wr99cuc0n2068sscuu5wu

  This is a private key. Store it securely.
```

**Prove two identities share a root** — a cryptographic proof that your forum-burner belongs to the same root as your main identity, without revealing the derivation path or the root secret itself.

```
$ nsec-tree prove private personal/forum-burner --mnemonic "abandon ... about"

  proof type    private
  master pubkey 3eb14b...8d656
  child pubkey  4f6d38...f61f26
  attestation   nsec-tree:own|3eb14b...8d656|4f6d38...f61f26
  signature     e3086d...56be4

  This proof shows shared root ownership
  without revealing how the child was derived.
```

**Verify a proof** — anyone can check it. Pipe the JSON proof straight in.

```
$ nsec-tree prove private personal/forum-burner --json | nsec-tree verify proof --stdin

  ✓ Proof is valid

  proof type    private
  master pubkey 3eb14b...8d656
  child pubkey  4f6d38...f61f26
```

## Why hierarchical identity?

Most Nostr users have one key. One npub, one nsec, one identity everywhere. That works until it doesn't — you want a throwaway for a forum, a separate identity for a project, a pseudonym that can't be linked back to your main account.

You could generate independent keys, but then you lose the thread. If one identity gets compromised or you need to prove they're related, you're stuck.

Hierarchical derivation solves this. One root produces a tree of identities. Each branch is cryptographically independent — different keys, no visible link. But because they all derive from the same root, you can selectively prove ownership when you choose to. Think of it as compartmentalised identity with an optional escape hatch.

## Why prove ownership?

By default, everything in `nsec-tree` is private and perfectly siloed. But sometimes you *want* to inject undeniable truth into a trustless network without doxing your whole identity tree. Linkage proofs enable powerful workflows:

- **Bootstrapping trust:** Launching a new bot or project? Generate a proof linking your high-reputation main account to the new npub so people know it is officially yours.
- **Secure key rotation:** If your phone is hacked and your daily-driver key is compromised, you can derive a new key from your offline root and post a proof. Your followers know exactly where to migrate.
- **Voluntary de-anonymization:** Run a whistleblower or pseudonym account perfectly anonymously, then cryptographically prove it was you later when you want to take credit.
- **Corporate hierarchy:** A master company root delegates to `@marketing` and `@support`, proving official affiliation without employees holding the master keys.

## Fully offline

`nsec-tree` makes zero network calls. No DNS lookups, no TLS handshakes, no relay connections, no telemetry. Every operation — root creation, derivation, export, proofs, Shamir splitting — runs entirely on your machine.

This means it works on air-gapped hardware. It means your root mnemonic never leaves the device running the command. And it means you can verify exactly what the tool does, because there is no server-side component to trust.

## What can you do?

| Command group | What it does |
|---------------|-------------|
| `root`        | Create, restore, or import a root identity (mnemonic or existing nsec) |
| `derive`      | Derive child identities at any path in your tree |
| `export`      | Extract npub, nsec, or full identity bundles for derived keys |
| `prove`       | Generate cryptographic proofs linking a child to its root |
| `verify`      | Verify a proof without needing the root secret |
| `shamir`      | Split your mnemonic into shares; recover from a threshold of them |
| `profile`     | Save and switch between named root profiles locally |
| `inspect`     | Examine paths and root metadata without deriving keys |
| `explain`     | Five built-in mini-tutorials on the concepts behind the tool |

Every command supports `--json` for scripting, `--quiet` for pipeline use, and `--no-hints` to suppress the "Try next" suggestions. Set `NSEC_TREE_NO_HINTS=1` to disable hints permanently.

## Install

Try it without installing:

```bash
npx nsec-tree-cli root create
```

Install globally to keep it:

```bash
npm install -g nsec-tree-cli
```

Requires Node.js 22 or later.

## Learn from the CLI itself

The `explain` command has five topics that teach the concepts as you go:

```
nsec-tree explain model       # What is nsec-tree? The mental model.
nsec-tree explain proofs      # How ownership proofs work.
nsec-tree explain recovery    # Mnemonics, Shamir, and backup strategies.
nsec-tree explain paths       # How derivation paths and indices work.
nsec-tree explain offline     # Why offline-first matters for key management.
```

No need to leave the terminal to understand what you're doing.

## JSON output for scripts

Every command supports `--json` for machine-readable output:

```
$ nsec-tree root create --json
{
  "rootType": "mnemonic-backed",
  "recoverable": true,
  "masterNpub": "npub139ps...vexeg",
  "mnemonic": "educate bitter aspect nerve step three knife clutch lake auction accident decide"
}
```

Pipe derivation into proof generation, feed proofs into verification, split mnemonics and recover them — all scriptable.

## Documentation

- [CLI-SPEC.md](./CLI-SPEC.md) — command grammar and design principles
- [JSON-SCHEMAS.md](./JSON-SCHEMAS.md) — stable JSON output schemas for all commands
- [ARCHITECTURE.md](./ARCHITECTURE.md) — separation of concerns between CLI and libraries
- [MISSION.md](./MISSION.md) — why this project exists

## Built on

- [`nsec-tree`](https://www.npmjs.com/package/nsec-tree) — the derivation and proof library
- [`@forgesworn/shamir-words`](https://www.npmjs.com/package/@forgesworn/shamir-words) — human-friendly Shamir secret sharing with BIP-39 word encoding

## Support

For issues and feature requests, see [GitHub Issues](https://github.com/forgesworn/nsec-tree-cli/issues).

If you find nsec-tree-cli useful, consider sending a tip:

- **Lightning:** `thedonkey@strike.me`
- **Nostr zaps:** `npub1mgvlrnf5hm9yf0n5mf9nqmvarhvxkc6remu5ec3vf8r0txqkuk7su0e7q2`

## Part of the ForgeSworn Toolkit

[ForgeSworn](https://forgesworn.dev) builds open-source cryptographic identity, payments, and coordination tools for Nostr.

| Library | What it does |
|---------|-------------|
| [nsec-tree](https://github.com/forgesworn/nsec-tree) | Deterministic sub-identity derivation |
| [ring-sig](https://github.com/forgesworn/ring-sig) | SAG/LSAG ring signatures on secp256k1 |
| [range-proof](https://github.com/forgesworn/range-proof) | Pedersen commitment range proofs |
| [canary-kit](https://github.com/forgesworn/canary-kit) | Coercion-resistant spoken verification |
| [spoken-token](https://github.com/forgesworn/spoken-token) | Human-speakable verification tokens |
| [toll-booth](https://github.com/forgesworn/toll-booth) | L402 payment middleware |
| [geohash-kit](https://github.com/forgesworn/geohash-kit) | Geohash toolkit with polygon coverage |
| [nostr-attestations](https://github.com/forgesworn/nostr-attestations) | NIP-VA verifiable attestations |
| [dominion](https://github.com/forgesworn/dominion) | Epoch-based encrypted access control |
| [nostr-veil](https://github.com/forgesworn/nostr-veil) | Privacy-preserving Web of Trust |

## Licence

MIT

A NIP proposal for hierarchical Nostr identity is in progress.
