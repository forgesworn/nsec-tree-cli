# AGENTS.md -- nsec-tree-cli

`nsec-tree-cli` is the standalone command-line application for hierarchical
Nostr identity workflows.

This repo owns:

- command grammar
- help and onboarding UX
- human-readable and `--json` output
- profile storage
- filesystem input and output
- safety warnings for sensitive material

This repo does **not** own the core cryptographic primitives. Those belong in
sibling libraries:

- `nsec-tree`
- `shamir-words`

## Build & test

```bash
npm install                        # install dependencies (nsec-tree, @forgesworn/shamir-words, @scure/bip39)
npm test                           # run all tests
node --test test/cli.test.js       # run a single test file
node ./bin/nsec-tree.js --help     # run the CLI
```

Dependencies are real npm packages. The sibling-directory fallback in `src/deps.js` is for local multi-repo development only -- `npm install` is the standard path.

Node >= 22 required. ESM-only (`"type": "module"`).

## Architecture

This is the **application layer** for the nsec-tree identity hierarchy. It owns CLI grammar, I/O, profiles, and formatting, not cryptography.

**Key files:**
- `bin/nsec-tree.js` -- entrypoint, delegates to `runCli()`
- `src/cli.js` -- command dispatch and logic. Each command group (`root`, `derive`, `export`, `prove`, `verify`, `shamir`, `profile`, `inspect`, `explain`) has its own `handle*` function. Custom arg parser (not a framework): `BOOLEAN_OPTIONS` and `VALUE_OPTIONS` sets define the grammar.
- `src/format.js` -- ANSI colour, box-drawing, tree rendering, label-value formatting. Exports `createFormatter({ colour })` factory. Decoupled from `process.stdout`: receives a `colour` boolean from cli.js based on TTY detection and `NO_COLOR` env var. Fixed 60-char content width.
- `src/explain.js` -- five mini-tutorials (model, proofs, recovery, paths, offline). Each topic receives a formatter and returns rich text.
- `src/deps.js` -- runtime dependency loading. Direct npm imports with sibling-directory fallback for local dev.
- `src/profile-store.js` -- profile CRUD, stored as JSON in `~/.nsec-tree/profiles/`

**Dependency boundary:** all crypto operations go through libraries loaded by `deps.js`:
- `nsec-tree` -- root creation, derivation, proofs, verification
- `@forgesworn/shamir-words` -- Shamir split/recover
- `@scure/bip39` -- mnemonic generation/validation

**Test files:**
- `test/helpers.js` -- shared `MemoryIo` class and `TEST_MNEMONIC`
- `test/cli.test.js` -- command behaviour happy paths and contextual next-steps
- `test/errors.test.js` -- error paths and validation
- `test/profile.test.js` -- profile lifecycle integration
- `test/format.test.js` -- format module unit tests, CLI formatting integration, `--no-hints`, env var, npx detection
- `test/explain.test.js` -- explain topic tests
- `test/prompt.test.js` -- interactive prompt behaviour

**Testing pattern:** tests construct a `MemoryIo` instance and pass it to `runCli(argv, io, options)`. `MemoryIo` accepts `isStdoutTty` to control colour output. Set `io.commandPrefix` to test npx detection. `options.profileBaseDir` redirects profile storage to a temp directory. No mocking of libraries.

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

## Conventions

- British English in user-facing text
- Two root types: `mnemonic-backed` (recoverable, supports Shamir) and `nsec-backed` (tree-capable, no phrase recovery). Always preserve this distinction.
- Every command supports `--json` (stable, machine-readable) and human-readable text by default
- `--quiet` emits bare values with no formatting
- `--no-hints` suppresses "Try next" suggestions; `NSEC_TREE_NO_HINTS=1` does the same permanently
- Human-mode output follows a HATEOAS pattern: every command shows contextual "Try next" suggestions guiding the user to the logical next step. When `--no-hints` or the env var is set, `fmt.nextSteps` is replaced with a no-op returning `null`, which `fmt.section()` filters out.
- npx detection: `io.commandPrefix` defaults to `nsec-tree` but shows `npx nsec-tree` when the CLI detects it was invoked via npx (checks for `_npx` in `process.argv[1]`). All hint commands use this prefix.
- Human-mode output uses `fmt.warning()` for sensitive content (mnemonics, nsecs, shares)
- Secret files written with mode `0o600`, directories with `0o700`
- Path segments validated by `PATH_SEGMENT_RE`: lowercase, shell-friendly, max 32 chars, optional `@index` suffix
- Colour respects TTY detection and `NO_COLOR` env var

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs `npm ci` then `npm test`. No external repo dependencies.
