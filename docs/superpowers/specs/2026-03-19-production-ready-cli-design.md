# nsec-tree-cli — Production-Ready CLI Design

**Date:** 2026-03-19
**Status:** Approved
**Goal:** Make nsec-tree-cli production-ready, world-class, and publishable via `npx nsec-tree`.

---

## 1. Package & Dependencies

### Changes to package.json

- Remove `"private": true`
- Add real dependencies:
  ```json
  {
    "dependencies": {
      "nsec-tree": "^1.4.0",
      "@forgesworn/shamir-words": "^1.0.2",
      "@scure/bip39": "^2.0.1"
    }
  }
  ```
- Add `"files": ["bin/", "src/"]` to control what gets published
- Add `"repository"`, `"homepage"`, `"author"` fields for npm presence
- Keep version at `0.0.0-development` (semantic-release handles versioning on publish)

### deps.js simplification

- Primary path: direct imports from npm packages
- Sibling fallback kept behind try/catch for local dev ergonomics only
- Remove the multi-candidate bip39 resolution chains — with `@scure/bip39` as a direct dep, it always resolves

---

## 2. File Structure

### Current

```
src/cli.js            — all command logic, parsing, formatting (1079 lines)
src/deps.js           — dynamic dependency loading with sibling fallback
src/profile-store.js  — profile CRUD (~183 lines)
```

### Proposed additions

```
src/format.js         — ANSI codes, box-drawing, tree rendering, colour helpers
src/explain.js        — rich explain topic content (mini-tutorials)
```

### format.js responsibilities

- ANSI colour constants: green, yellow, red, dim, bold, cyan, reset
- TTY detection: colours only when stdout is a TTY
- `NO_COLOR` env var support (disable colours when set)
- Box-drawing: `boxHeader(title)` for framed section headers
- Tree-drawing: `renderTree(segments)` for derivation path visualisation using `├──`, `└──`
- Label-value formatting: `labelValue(label, value)` with dim labels, bright values
- Warning banners: `warning(text)` in yellow
- Next-steps suggestions: `nextSteps(commands)` with dim "Try next:" header
- Mnemonic wrapping: word-wrap at reasonable width rather than one long line

### explain.js responsibilities

- Each topic as a named export function returning formatted text
- Five topics: `model`, `proofs`, `recovery`, `paths` (new), `offline` (new)
- Inline command suggestions at the end of each topic
- Uses format.js for colour/layout

### cli.js changes

- All string formatting calls route through format.js
- Explain handler delegates to explain.js
- Command dispatch and logic unchanged
- Net reduction in line count as formatting moves out

---

## 3. CLI Output Design

All formatting applies to human mode only. `--json` and `--quiet` output are unchanged.

### Design language

- **Box headers** for primary actions (root create/restore, shamir split/recover)
- **Dim labels, bright values** for all label-value pairs
- **Tree drawing** for derivation path visualisation
- **Yellow warning banners** for sensitive output (mnemonics, nsecs, shares)
- **Green checkmark** for success states (proof valid)
- **Red cross** for failure states (proof invalid)
- **"Try next:" suggestions** after primary actions to teach the workflow
- **Mnemonic word-wrap** at reasonable width

### root create

```
╭─────────────────────────────────────────────╮
│  Root created                               │
╰─────────────────────────────────────────────╯

  root type     mnemonic-backed
  recoverable   yes
  master npub   npub1jwvx...h5my2y

  mnemonic      hood eternal already wasp galaxy
                curious bus entry replace project
                trick wish

  Store this mnemonic offline. It cannot be recovered.

  Try next:
    nsec-tree derive path personal
    nsec-tree profile save main --use
```

### derive path

```
  root type     mnemonic-backed
  path          personal@0 / forum-burner@0

  root
    ├─ personal@0        npub1abc...
    └─ forum-burner@0    npub1fak...  (leaf)

  No secret output. Use export nsec to extract the private key.
```

### prove private/full

```
  proof type      private
  master pubkey   ab3f...
  child pubkey    9ed3...
  attestation     <hex>
  signature       <hex>

  This proof shows shared root ownership
  without revealing how the child was derived.
```

### verify proof (valid)

```
  Proof is valid

  proof type      private
  master pubkey   ab3f...
  child pubkey    9ed3...
```

### verify proof (invalid)

```
  Proof is invalid
```

### profile list

```
  * main       mnemonic-backed   recoverable   npub1jwv...
    burner     nsec-backed       no recovery   npub1abc...
```

### shamir split

Box header, share listing with word-wrap, warning banner about secure storage.

### Error output

Errors remain on stderr. Format: `Error: <message>`. For common mistakes, append a suggestion line:

```
Error: No root input provided.
  Use --mnemonic, --nsec, --root-file, --stdin, or --profile.
```

---

## 4. Explain Mini-Tutorials

Five topics, each 15-25 lines of formatted text. All use the approachable, teaching voice.

### explain model

- Opens with "What is nsec-tree?"
- One root secret derives many unlinkable Nostr identities
- Analogy: master key that cuts unlimited unique keys
- Covers both root types and why the distinction matters
- Ends with: "Try it: nsec-tree root create"

### explain proofs

- Opens with "Why would you prove two identities share a root?"
- Private vs full proof distinction with real-world scenarios
- Analogy: showing two passports were issued by the same country without revealing the country
- Ends with: "Try it: nsec-tree prove private personal"

### explain recovery

- Opens with "What happens if you lose your root?"
- Mnemonic backup vs Shamir splitting — when to use each
- Key insight: nsec-backed roots derive the tree but cannot be phrase-recovered
- Ends with: "Try it: nsec-tree shamir split --shares 3 --threshold 2"

### explain paths (new)

- How path syntax works: segments, indexes, nesting
- Why deterministic derivation matters — same root + same path = same identity, always
- Ends with: "Try it: nsec-tree inspect path personal/forum-burner@2"

### explain offline (new)

- The value proposition: every command works without a network connection
- Why this matters for crypto key management — no DNS, no TLS, no MITM surface
- How to use the CLI on an air-gapped machine
- Closing line: "This entire CLI was designed so that your most sensitive operation — creating and managing root secrets — never needs to trust a network."

---

## 5. README

Transforms from internal planning doc to developer-facing landing page.

### Structure

1. **Opening command:** `npx nsec-tree root create` — no preamble
2. **One-paragraph pitch:** What it is, what it solves, offline-first promise
3. **"See it in action":** Terminal walkthrough of the wow flow (5 commands, annotated)
4. **"Why hierarchical identity?":** Teaching moment. One key = one identity is limiting. This fixes it.
5. **"Fully offline":** No network calls, no DNS, no TLS. Air-gapped-ready. Confidence-builder.
6. **"What can you do?":** Quick command group reference with one-line descriptions
7. **Install:** `npx nsec-tree` to try, `npm install -g nsec-tree-cli` to keep
8. **"Learn from the CLI itself":** Points to explain commands
9. **Footer:** MIT licence, library links, "NIP proposal in progress" teaser

### Voice

Approachable and teaching. Assumes the reader might not know hierarchical identity yet. Leads with "why", uses analogies, walks through the story.

---

## 6. Test Coverage

### Testing pattern

Same as existing: `MemoryIo` instances passed to `runCli(argv, io, options)`. `options.profileBaseDir` redirects profile storage to temp dirs. No mocking of libraries. No new test dependencies.

### Error path tests

- Unknown command returns exit code 1
- Unknown subcommand for each command group
- Missing required args: no path for derive, no shares/threshold for shamir split
- Conflicting root sources: --mnemonic and --nsec together
- Invalid path syntax: uppercase, leading slash, trailing slash, empty
- nsec-backed root attempting shamir split
- Profile name validation failures
- Duplicate profile save without --force

### Missing command coverage

- `root inspect` from profile, mnemonic, and nsec
- `root restore` and `root import-nsec`
- `inspect path` and `inspect root`
- `explain` all five topics (model, proofs, recovery, paths, offline)
- `export npub` and `export identity`
- `prove full`
- `profile show` (explicit name and from active), `profile remove`, `profile list` empty state
- `--help` flag returns help text and exit 0

### Formatting tests

- TTY mode: output contains ANSI escape codes
- Non-TTY mode: output contains no ANSI escape codes
- `NO_COLOR=1`: output contains no ANSI escape codes even when TTY
- Box-drawing characters present in human mode for root create
- Tree-drawing characters present in human mode for derive path
- `--json` output is valid JSON and matches expected schema (regression guard)
- `--quiet` output is bare values with no formatting

### Profile integration tests

- Save, list, use, show, remove lifecycle
- Active profile auto-selection for derive/export/prove
- Profile removal clears active status
- --force overwrites existing profile

---

## 7. Release Readiness

### LICENSE file

Add MIT licence file to repo root. The licence is already declared in package.json but no file exists.

### CI simplification

The GitHub Actions workflow currently clones sibling repos and builds them. With real npm dependencies, it simplifies to:

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with:
      node-version: 22
  - run: npm ci
  - run: npm test
```

Remove the `FORGESWORN_REPO_TOKEN` secret dependency and sibling repo checkout steps.

### deps.js

- Primary path: `import('nsec-tree')`, `import('@forgesworn/shamir-words')`, `import('@scure/bip39')`
- Sibling fallback: kept behind try/catch, only activates when npm packages are not installed
- Simpler, shorter, more obvious

---

## Out of Scope

- NIP draft (scheduled for tomorrow's session)
- Semantic-release configuration
- QR-oriented output
- Shell completions
- Man pages
- Profile metadata/labels
- Import/export bundles

---

## Implementation Order

1. Package & deps (package.json, deps.js, LICENSE, CI)
2. format.js (ANSI, box-drawing, tree rendering, helpers)
3. explain.js (five mini-tutorials)
4. cli.js refactor (use format.js, wire up new explain topics)
5. Tests (comprehensive coverage across all commands and formatting)
6. README (developer-facing landing page)
