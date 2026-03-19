# Contributing to nsec-tree-cli

## Quick start

```bash
git clone https://github.com/forgesworn/nsec-tree-cli.git
cd nsec-tree-cli
npm install
npm test          # 92 tests, should all pass
node ./bin/nsec-tree.js root create
```

Requires Node.js 22 or later. ESM-only.

## Architecture

nsec-tree-cli is the **application layer** — it owns CLI grammar, formatting, profiles, and I/O. It does not own cryptography.

```
bin/nsec-tree.js       entrypoint — delegates to runCli()
src/cli.js             command dispatch and logic (one handle* per command group)
src/format.js          ANSI colour, box-drawing, tree rendering
src/explain.js         five built-in mini-tutorials
src/deps.js            runtime dependency loading
src/profile-store.js   profile CRUD (~/.nsec-tree/profiles/)
```

All crypto operations go through npm packages loaded by `deps.js`:
- `nsec-tree` — derivation, proofs, verification
- `@forgesworn/shamir-words` — Shamir split/recover
- `@scure/bip39` — mnemonic generation

If logic is generally useful to applications, it belongs in a library. If it's about terminal UX, it belongs here.

## Running tests

```bash
npm test                         # all tests
node --test test/cli.test.js     # single file
```

Tests use `node:test` (built-in, no framework). The pattern: construct a `MemoryIo` instance, pass it to `runCli(argv, io, options)`, assert on stdout/stderr buffers. No mocking. See `test/helpers.js` for the shared `MemoryIo` class.

## Conventions

- **British English** in all user-facing text (colour, licence, initialise)
- **Two root types** — always preserve the distinction between `mnemonic-backed` (recoverable) and `nsec-backed` (tree-capable, no phrase recovery)
- **`--json`** output is stable and machine-readable — never add ANSI codes or formatting
- **`--quiet`** emits bare values only
- **`--no-hints`** suppresses "Try next" suggestions
- **HATEOAS pattern** — every human-mode command shows contextual next-step suggestions
- **npx detection** — suggestions use `npx nsec-tree` when invoked via npx
- Secrets written with mode `0o600`, directories with `0o700`
- Path segments: lowercase, shell-friendly, max 32 chars, optional `@index` suffix

## Submitting changes

1. Create a feature branch from `main`
2. Make your changes — keep commits focused and use `type: description` format
3. Run `npm test` — all tests must pass
4. Open a pull request against `main`

If your change adds a new command or flag, add tests in the appropriate file:
- `test/cli.test.js` — command happy paths
- `test/errors.test.js` — error cases
- `test/profile.test.js` — profile lifecycle
- `test/format.test.js` — formatting and output modes

## What not to do

- Don't re-implement cryptographic logic that belongs in `nsec-tree` or `@forgesworn/shamir-words`
- Don't add network-dependent features — the CLI must stay offline-first
- Don't break `--json` output shapes — scripts depend on them
