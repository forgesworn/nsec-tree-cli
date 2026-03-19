# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & test

```bash
npm install                        # install dependencies (nsec-tree, @forgesworn/shamir-words, @scure/bip39)
npm test                           # run all tests (81 tests across 5 files)
node --test test/cli.test.js       # run a single test file
node ./bin/nsec-tree.js --help     # run the CLI
```

Dependencies are real npm packages. The sibling-directory fallback in `src/deps.js` is for local multi-repo development only — `npm install` is the standard path.

Node >= 22 required. ESM-only (`"type": "module"`).

## Architecture

This is the **application layer** for the nsec-tree identity hierarchy. It owns CLI grammar, I/O, profiles, and formatting — not cryptography.

**Key files:**
- `bin/nsec-tree.js` — entrypoint, delegates to `runCli()`
- `src/cli.js` — command dispatch and logic. Each command group (`root`, `derive`, `export`, `prove`, `verify`, `shamir`, `profile`, `inspect`, `explain`) has its own `handle*` function. Custom arg parser (not a framework) — `BOOLEAN_OPTIONS` and `VALUE_OPTIONS` sets define the grammar.
- `src/format.js` — ANSI colour, box-drawing, tree rendering, label-value formatting. Exports `createFormatter({ colour })` factory. Decoupled from `process.stdout` — receives a `colour` boolean from cli.js based on TTY detection and `NO_COLOR` env var. Fixed 60-char content width.
- `src/explain.js` — five mini-tutorials (model, proofs, recovery, paths, offline). Each topic receives a formatter and returns rich text.
- `src/deps.js` — runtime dependency loading. Direct npm imports with sibling-directory fallback for local dev.
- `src/profile-store.js` — profile CRUD, stored as JSON in `~/.nsec-tree/profiles/`

**Dependency boundary:** all crypto operations go through libraries loaded by `deps.js`:
- `nsec-tree` — root creation, derivation, proofs, verification
- `@forgesworn/shamir-words` — Shamir split/recover
- `@scure/bip39` — mnemonic generation/validation

**Test files:**
- `test/helpers.js` — shared `MemoryIo` class and `TEST_MNEMONIC`
- `test/cli.test.js` — command behaviour happy paths (23 tests)
- `test/errors.test.js` — error paths and validation (21 tests)
- `test/profile.test.js` — profile lifecycle integration (5 tests)
- `test/format.test.js` — format module unit tests + CLI formatting integration (19 tests)
- `test/explain.test.js` — explain topic tests (12 tests)

**Testing pattern:** tests construct a `MemoryIo` instance and pass it to `runCli(argv, io, options)`. `MemoryIo` accepts `isStdoutTty` to control colour output. `options.profileBaseDir` redirects profile storage to a temp directory. No mocking of libraries.

## Conventions

- British English in user-facing text
- Two root types: `mnemonic-backed` (recoverable, supports Shamir) and `nsec-backed` (tree-capable, no phrase recovery) — always preserve this distinction
- Every command supports `--json` (stable, machine-readable) and human-readable text by default
- `--quiet` emits bare values with no formatting
- Human-mode output uses `fmt.warning()` for sensitive content (mnemonics, nsecs, shares)
- Secret files written with mode `0o600`, directories with `0o700`
- Path segments validated by `PATH_SEGMENT_RE`: lowercase, shell-friendly, max 32 chars, optional `@index` suffix
- Colour respects TTY detection and `NO_COLOR` env var

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs `npm ci` then `npm test`. No external repo dependencies.
