# Production-Ready CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make nsec-tree-cli production-ready with rich terminal formatting, comprehensive tests, and a polished README — publishable via `npx nsec-tree`.

**Architecture:** Extract formatting into `src/format.js` (factory pattern, zero deps), explain content into `src/explain.js`. Refactor `src/cli.js` to use both. Add real npm dependencies so `npx nsec-tree` works. Split tests across four focused files.

**Tech Stack:** Node.js >= 22, ESM, `node:test`, raw ANSI escape codes, `nsec-tree`, `@forgesworn/shamir-words`, `@scure/bip39`

**Spec:** `docs/superpowers/specs/2026-03-19-production-ready-cli-design.md`

---

### Task 1: Package & Dependencies

**Files:**
- Modify: `package.json`
- Modify: `src/deps.js`
- Modify: `.github/workflows/ci.yml`
- Create: `LICENSE`

- [ ] **Step 1: Update package.json**

Remove `"private": true`. Add dependencies, files, repository, homepage, author fields:

```json
{
  "name": "nsec-tree-cli",
  "version": "0.0.0-development",
  "description": "Offline-first CLI for hierarchical Nostr identities",
  "type": "module",
  "engines": {
    "node": ">=22"
  },
  "bin": {
    "nsec-tree": "./bin/nsec-tree.js"
  },
  "files": [
    "bin/",
    "src/"
  ],
  "scripts": {
    "start": "node ./bin/nsec-tree.js",
    "help": "node ./bin/nsec-tree.js --help",
    "test": "node --test"
  },
  "dependencies": {
    "@forgesworn/shamir-words": "^1.0.2",
    "@scure/bip39": "^2.0.1",
    "nsec-tree": "^1.4.0"
  },
  "keywords": [
    "nostr",
    "nsec",
    "npub",
    "cli",
    "offline",
    "identity",
    "privacy",
    "shamir",
    "hierarchical",
    "derivation",
    "proof"
  ],
  "repository": {
    "type": "git",
    "url": "git+https://github.com/forgesworn/nsec-tree-cli.git"
  },
  "homepage": "https://github.com/forgesworn/nsec-tree-cli#readme",
  "author": "ForgeSworn",
  "license": "MIT"
}
```

- [ ] **Step 2: Simplify deps.js**

Replace the multi-candidate resolution with direct npm imports and a sibling fallback for local dev:

```js
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const currentDir = dirname(fileURLToPath(import.meta.url))

let dependencyCache

function siblingPath(...segments) {
  return pathToFileURL(resolve(currentDir, '..', '..', ...segments)).href
}

async function tryImport(specifier, ...fallbacks) {
  try {
    return await import(specifier)
  } catch {
    for (const fallback of fallbacks) {
      try {
        return await import(fallback)
      } catch {}
    }
    throw new Error(`Could not resolve "${specifier}". Run npm install or check sibling repos.`)
  }
}

export async function loadDependencies() {
  if (dependencyCache) {
    return dependencyCache
  }

  const nsecTree = await tryImport(
    'nsec-tree',
    siblingPath('nsec-tree', 'dist', 'index.js'),
  )

  const shamirWords = await tryImport(
    '@forgesworn/shamir-words',
    siblingPath('shamir-words', 'dist', 'index.js'),
  )

  const bip39 = await tryImport('@scure/bip39')
  const bip39English = await tryImport('@scure/bip39/wordlists/english.js')

  dependencyCache = { nsecTree, shamirWords, bip39, bip39English }
  return dependencyCache
}
```

- [ ] **Step 3: Create LICENSE file**

```
MIT License

Copyright (c) 2026 ForgeSworn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 4: Simplify CI workflow**

Replace `.github/workflows/ci.yml` with:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test
```

- [ ] **Step 5: Install dependencies and verify tests pass**

Run: `npm install && npm test`
Expected: all 6 existing tests pass, `node_modules/` populated with nsec-tree, @forgesworn/shamir-words, @scure/bip39

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/deps.js LICENSE .github/workflows/ci.yml
git commit -m "feat: add npm dependencies and prepare for publish"
```

---

### Task 2: Format Module

**Files:**
- Create: `src/format.js`
- Create: `test/format.test.js`

- [ ] **Step 1: Write format.test.js with core tests**

```js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createFormatter } from '../src/format.js'

describe('createFormatter', () => {
  describe('with colour enabled', () => {
    const fmt = createFormatter({ colour: true })

    it('wraps label-value with ANSI codes', () => {
      const result = fmt.labelValue('root type', 'mnemonic-backed')
      assert.match(result, /\x1b\[/)
      assert.match(result, /root type/)
      assert.match(result, /mnemonic-backed/)
    })

    it('renders a box header with box-drawing characters', () => {
      const result = fmt.boxHeader('Root created')
      assert.match(result, /╭/)
      assert.match(result, /╰/)
      assert.match(result, /Root created/)
    })

    it('renders a warning with ANSI yellow', () => {
      const result = fmt.warning('Store this mnemonic offline.')
      assert.match(result, /\x1b\[33m/) // yellow
      assert.match(result, /Store this mnemonic offline/)
    })

    it('renders success with green checkmark', () => {
      const result = fmt.success('Proof is valid')
      assert.match(result, /\x1b\[32m/) // green
      assert.match(result, /Proof is valid/)
    })

    it('renders failure with red cross', () => {
      const result = fmt.failure('Proof is invalid')
      assert.match(result, /\x1b\[31m/) // red
      assert.match(result, /Proof is invalid/)
    })

    it('renders next steps with dim header', () => {
      const result = fmt.nextSteps(['nsec-tree derive path personal'])
      assert.match(result, /Try next/)
      assert.match(result, /nsec-tree derive path personal/)
    })

    it('wraps mnemonic words at content width', () => {
      const words = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
      const result = fmt.wrapWords(words)
      const lines = result.split('\n')
      assert.ok(lines.length >= 2, 'mnemonic should wrap to multiple lines')
    })
  })

  describe('with colour disabled', () => {
    const fmt = createFormatter({ colour: false })

    it('renders label-value without ANSI codes', () => {
      const result = fmt.labelValue('root type', 'mnemonic-backed')
      assert.doesNotMatch(result, /\x1b\[/)
      assert.match(result, /root type/)
      assert.match(result, /mnemonic-backed/)
    })

    it('renders box header without ANSI codes', () => {
      const result = fmt.boxHeader('Root created')
      assert.doesNotMatch(result, /\x1b\[/)
      assert.match(result, /╭/)
      assert.match(result, /Root created/)
    })

    it('renders warning without ANSI codes', () => {
      const result = fmt.warning('Sensitive output.')
      assert.doesNotMatch(result, /\x1b\[/)
      assert.match(result, /Sensitive output/)
    })
  })

  describe('tree rendering', () => {
    const fmt = createFormatter({ colour: false })

    it('renders single-segment path', () => {
      const result = fmt.renderTree([
        { name: 'personal', requestedIndex: 0, actualIndex: 0, npub: 'npub1abc' },
      ])
      assert.match(result, /root/)
      assert.match(result, /└─/)
      assert.match(result, /personal@0/)
      assert.match(result, /npub1abc/)
    })

    it('renders nested path with proper indentation', () => {
      const result = fmt.renderTree([
        { name: 'personal', requestedIndex: 0, actualIndex: 0, npub: 'npub1abc' },
        { name: 'forum-burner', requestedIndex: 0, actualIndex: 0, npub: 'npub1def' },
      ])
      assert.match(result, /root/)
      assert.match(result, /└─ personal@0/)
      assert.match(result, /└─ forum-burner@0/)
      // forum-burner should be indented further than personal
      const lines = result.split('\n')
      const personalLine = lines.find(l => l.includes('personal@0'))
      const burnerLine = lines.find(l => l.includes('forum-burner@0'))
      const personalIndent = personalLine.search(/\S/)
      const burnerIndent = burnerLine.search(/\S/)
      assert.ok(burnerIndent > personalIndent, 'child should be indented further than parent')
    })

    it('marks the last segment as leaf', () => {
      const result = fmt.renderTree([
        { name: 'personal', requestedIndex: 0, actualIndex: 0, npub: 'npub1abc' },
      ])
      assert.match(result, /leaf/)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/format.test.js`
Expected: FAIL — `src/format.js` does not exist yet

- [ ] **Step 3: Implement format.js**

```js
const CONTENT_WIDTH = 60
const LABEL_WIDTH = 14

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
}

export function createFormatter({ colour = false } = {}) {
  const c = colour
    ? {
        reset: ANSI.reset,
        bold: ANSI.bold,
        dim: ANSI.dim,
        red: ANSI.red,
        green: ANSI.green,
        yellow: ANSI.yellow,
        cyan: ANSI.cyan,
      }
    : { reset: '', bold: '', dim: '', red: '', green: '', yellow: '', cyan: '' }

  function labelValue(label, value) {
    const padded = label.padEnd(LABEL_WIDTH)
    return `  ${c.dim}${padded}${c.reset}${c.bold}${value}${c.reset}`
  }

  function boxHeader(title) {
    const inner = CONTENT_WIDTH - 4
    const padded = title.padEnd(inner)
    return [
      `${c.cyan}╭${'─'.repeat(CONTENT_WIDTH - 2)}╮${c.reset}`,
      `${c.cyan}│${c.reset}  ${c.bold}${padded}${c.reset}${c.cyan}│${c.reset}`,
      `${c.cyan}╰${'─'.repeat(CONTENT_WIDTH - 2)}╯${c.reset}`,
    ].join('\n')
  }

  function warning(text) {
    return `  ${c.yellow}${text}${c.reset}`
  }

  function success(text) {
    return `  ${c.green}✓ ${text}${c.reset}`
  }

  function failure(text) {
    return `  ${c.red}✗ ${text}${c.reset}`
  }

  function nextSteps(commands) {
    const lines = [`  ${c.dim}Try next:${c.reset}`]
    for (const cmd of commands) {
      lines.push(`    ${c.cyan}${cmd}${c.reset}`)
    }
    return lines.join('\n')
  }

  function wrapWords(text, indent = LABEL_WIDTH + 2) {
    const words = text.split(/\s+/)
    const maxWidth = CONTENT_WIDTH - indent
    const lines = []
    let current = ''

    for (const word of words) {
      if (current && current.length + 1 + word.length > maxWidth) {
        lines.push(current)
        current = word
      } else {
        current = current ? `${current} ${word}` : word
      }
    }
    if (current) lines.push(current)

    return lines.join(`\n${' '.repeat(indent)}`)
  }

  function renderTree(segments) {
    const lines = [`  ${c.dim}root${c.reset}`]
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      const isLast = i === segments.length - 1
      const depth = i + 1
      const indent = '  ' + '   '.repeat(depth)
      const branch = '└─'
      const label = `${seg.name}@${seg.actualIndex}`
      const suffix = isLast ? `  ${c.dim}(leaf)${c.reset}` : ''
      lines.push(`${indent}${c.dim}${branch}${c.reset} ${c.bold}${label}${c.reset}${' '.repeat(Math.max(1, 20 - label.length))}${c.cyan}${seg.npub}${c.reset}${suffix}`)
    }
    return lines.join('\n')
  }

  function section(lines) {
    return lines.filter(l => l !== null && l !== undefined).join('\n')
  }

  function blank() {
    return ''
  }

  return {
    labelValue,
    boxHeader,
    warning,
    success,
    failure,
    nextSteps,
    wrapWords,
    renderTree,
    section,
    blank,
    c,
    CONTENT_WIDTH,
    LABEL_WIDTH,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/format.test.js`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/format.js test/format.test.js
git commit -m "feat: add format module with ANSI, box-drawing, tree rendering"
```

---

### Task 3: Explain Module

**Files:**
- Create: `src/explain.js`
- Create: `test/explain.test.js`

- [ ] **Step 1: Write explain.test.js**

```js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createFormatter } from '../src/format.js'
import { explainTopic, TOPIC_NAMES } from '../src/explain.js'

const fmt = createFormatter({ colour: false })

describe('explain topics', () => {
  it('exports all five topic names', () => {
    assert.deepStrictEqual(TOPIC_NAMES, ['model', 'proofs', 'recovery', 'paths', 'offline'])
  })

  for (const topic of ['model', 'proofs', 'recovery', 'paths', 'offline']) {
    it(`renders ${topic} topic without errors`, () => {
      const result = explainTopic(topic, fmt)
      assert.ok(result.length > 100, `${topic} should be substantial`)
      assert.ok(typeof result === 'string')
    })

    it(`${topic} topic includes a "Try" suggestion`, () => {
      const result = explainTopic(topic, fmt)
      assert.match(result, /nsec-tree/)
    })
  }

  it('throws for unknown topic', () => {
    assert.throws(() => explainTopic('unknown', fmt), /Unknown explain topic/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/explain.test.js`
Expected: FAIL — `src/explain.js` does not exist yet

- [ ] **Step 3: Implement explain.js**

Each topic is a function that receives a formatter and returns rich text. Content follows the spec: approachable voice, analogies, inline command suggestions.

```js
export const TOPIC_NAMES = ['model', 'proofs', 'recovery', 'paths', 'offline']

function topicModel(fmt) {
  return fmt.section([
    `  ${fmt.c.bold}What is nsec-tree?${fmt.c.reset}`,
    '',
    '  Most Nostr usage treats a private key as a single identity.',
    '  That works — but it means separate contexts (personal, work,',
    '  anonymous) each need their own unrelated key. You end up with',
    '  key sprawl, no way to prove connections between identities,',
    '  and no structured recovery plan.',
    '',
    '  nsec-tree takes a different approach: one root secret derives',
    '  an entire tree of unlinkable Nostr identities.',
    '',
    '  Think of it like a master key that can cut unlimited unique',
    '  keys. Each one works independently — a real nsec/npub pair —',
    '  but they all trace back to one source that only you know.',
    '',
    `  ${fmt.c.dim}There are two kinds of root:${fmt.c.reset}`,
    '',
    `  ${fmt.c.bold}mnemonic-backed${fmt.c.reset}  A 12-word recovery phrase. Can derive the`,
    '                   full tree AND be backed up with Shamir splitting.',
    `  ${fmt.c.bold}nsec-backed${fmt.c.reset}      An existing nsec. Can derive the full tree`,
    '                   but cannot be phrase-recovered.',
    '',
    '  Both root types produce the same tree. The difference is',
    '  recovery — not capability.',
    '',
    fmt.nextSteps(['nsec-tree root create', 'nsec-tree explain recovery']),
  ])
}

function topicProofs(fmt) {
  return fmt.section([
    `  ${fmt.c.bold}Why prove two identities share a root?${fmt.c.reset}`,
    '',
    '  By default, derived identities are unlinkable. Nobody can',
    '  tell that your "personal" and "anon" npubs come from the',
    '  same root. That is the point.',
    '',
    '  But sometimes you want to prove a connection — to show',
    '  continuity, build trust, or verify ownership. nsec-tree',
    '  gives you two kinds of proof:',
    '',
    `  ${fmt.c.bold}private proof${fmt.c.reset}   Shows that two identities share the same`,
    '                  root without revealing the derivation path.',
    '                  Like showing two passports were issued by',
    '                  the same country — without naming the country.',
    '',
    `  ${fmt.c.bold}full proof${fmt.c.reset}      Reveals the root AND the derivation path.`,
    '                  Full transparency: anyone can verify the exact',
    '                  relationship between root and child.',
    '',
    '  Proofs are optional and selective. You choose when to link',
    '  identities and how much to reveal. Most identities stay',
    '  private forever — that is the default.',
    '',
    fmt.nextSteps([
      'nsec-tree prove private personal',
      'nsec-tree prove full personal',
    ]),
  ])
}

function topicRecovery(fmt) {
  return fmt.section([
    `  ${fmt.c.bold}What happens if you lose your root?${fmt.c.reset}`,
    '',
    '  If your root is mnemonic-backed, you have options:',
    '',
    `  ${fmt.c.bold}Phrase backup${fmt.c.reset}    Write down the 12-word mnemonic and store`,
    '                   it offline. The same phrase always recreates',
    '                   the same root and the same identity tree.',
    '',
    `  ${fmt.c.bold}Shamir splitting${fmt.c.reset} Split the mnemonic into N shares where',
    '                   any T of them can reconstruct it. Give shares',
    '                   to trusted people or store in separate places.',
    '                   No single share reveals the mnemonic.',
    '',
    '  If your root is nsec-backed, it can still derive the full',
    '  tree — but it cannot be phrase-recovered or Shamir-split.',
    '  Guard the nsec itself, because there is no backup path.',
    '',
    `  ${fmt.c.dim}Rule of thumb:${fmt.c.reset} if long-term recovery matters, start`,
    '  with a mnemonic-backed root.',
    '',
    fmt.nextSteps([
      'nsec-tree shamir split --shares 3 --threshold 2',
      'nsec-tree explain model',
    ]),
  ])
}

function topicPaths(fmt) {
  return fmt.section([
    `  ${fmt.c.bold}How do paths work?${fmt.c.reset}`,
    '',
    '  Every derived identity has a path — a sequence of named',
    '  segments separated by slashes:',
    '',
    `    ${fmt.c.cyan}personal${fmt.c.reset}`,
    `    ${fmt.c.cyan}personal/forum-burner${fmt.c.reset}`,
    `    ${fmt.c.cyan}work/project-alpha/signing-key@2${fmt.c.reset}`,
    '',
    '  Each segment has a name and an optional index (default 0).',
    '  The @index lets you create multiple identities at the same',
    '  level — like having several "signing-key" identities under',
    '  one project.',
    '',
    `  ${fmt.c.dim}Segment rules:${fmt.c.reset}`,
    '    - lowercase letters, numbers, and hyphens',
    '    - max 32 characters',
    '    - must start with a letter or number',
    '',
    `  ${fmt.c.bold}Derivation is deterministic.${fmt.c.reset} The same root + the same path`,
    '  always produces the same identity. You never need to store',
    '  derived keys — you can always recreate them from the root.',
    '',
    fmt.nextSteps([
      'nsec-tree inspect path personal/forum-burner@2',
      'nsec-tree derive path personal/forum-burner',
    ]),
  ])
}

function topicOffline(fmt) {
  return fmt.section([
    `  ${fmt.c.bold}Why offline-first?${fmt.c.reset}`,
    '',
    '  Every nsec-tree command works without a network connection.',
    '  No DNS lookups. No TLS handshakes. No API calls. No relays.',
    '',
    '  This is not a limitation — it is the design.',
    '',
    '  When you create a root, derive identities, generate proofs,',
    '  or split recovery shares, the most sensitive cryptographic',
    '  operations happen entirely on your machine. There is no',
    '  server to trust, no connection to intercept, no metadata',
    '  to leak.',
    '',
    `  ${fmt.c.dim}Air-gapped workflows:${fmt.c.reset}`,
    '    1. Install nsec-tree on an offline machine',
    '    2. Create your root and derive identities',
    '    3. Export only the child npubs/nsecs you need',
    '    4. Transfer those to your online machine',
    '    5. The root never touches a network',
    '',
    '  Your most sensitive operation — creating and managing',
    '  root secrets — never needs to trust a network.',
    '',
    fmt.nextSteps([
      'nsec-tree root create',
      'nsec-tree explain model',
    ]),
  ])
}

const TOPICS = {
  model: topicModel,
  proofs: topicProofs,
  recovery: topicRecovery,
  paths: topicPaths,
  offline: topicOffline,
}

export function explainTopic(topic, fmt) {
  const fn = TOPICS[topic]
  if (!fn) {
    throw new Error(`Unknown explain topic "${topic}". Topics: ${TOPIC_NAMES.join(', ')}`)
  }
  return fn(fmt)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/explain.test.js`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/explain.js test/explain.test.js
git commit -m "feat: add explain module with five mini-tutorials"
```

---

### Task 4: Refactor cli.js to Use Format and Explain Modules

**Files:**
- Modify: `src/cli.js`

This is the largest task. The command dispatch and logic stay the same — we're replacing inline string formatting with calls to the formatter, and wiring up the new explain topics.

- [ ] **Step 1: Run existing tests to confirm green baseline**

Run: `node --test test/cli.test.js`
Expected: all 6 tests PASS

- [ ] **Step 2: Add imports and create formatter in runCli**

At the top of `src/cli.js`, add:

```js
import { createFormatter } from './format.js'
import { explainTopic as getExplainContent, TOPIC_NAMES } from './explain.js'
```

In `runCli()`, after `const libraries = await loadDependencies()`, add:

```js
const useColour = io.isStdoutTty && !process.env.NO_COLOR
const fmt = createFormatter({ colour: useColour })
```

Then update every dispatch call in `runCli()` to pass `fmt`:

```js
const command = parsed.positionals[0]
if (command === 'root') return await handleRoot(parsed, io, libraries, options, fmt)
if (command === 'derive') return await handleDerive(parsed, io, libraries, options, fmt)
if (command === 'export') return await handleExport(parsed, io, libraries, options, fmt)
if (command === 'prove') return await handleProve(parsed, io, libraries, options, fmt)
if (command === 'verify') return await handleVerify(parsed, io, libraries, fmt)
if (command === 'shamir') return await handleShamir(parsed, io, libraries, options, fmt)
if (command === 'profile') return await handleProfile(parsed, io, libraries, options, fmt)
if (command === 'inspect') return await handleInspect(parsed, io, libraries, options, fmt)
if (command === 'explain') return await handleExplain(parsed, io, fmt)
```

Update each handler's function signature to accept `fmt` as the last parameter. Also update `withDerivedPath` to accept and pass `fmt` through to its callback.

- [ ] **Step 3: Update HELP_TEXT**

Replace the explain line in `HELP_TEXT`:

```
  nsec-tree explain model|proofs|recovery
```

with:

```
  nsec-tree explain model|proofs|recovery|paths|offline
```

- [ ] **Step 4: Refactor handleRoot — root create**

In the `root create` branch, replace the human-mode output block (the `if` that is neither `--json` nor `--quiet`, ending with `return 0`). Keep `--json` and `--quiet` paths unchanged. The human mode becomes:

```js
if (!hasFlag(parsed, 'json') && !hasFlag(parsed, 'quiet')) {
  const lines = [
    fmt.boxHeader('Root created'),
    '',
    fmt.labelValue('root type', 'mnemonic-backed'),
    fmt.labelValue('recoverable', 'yes'),
    fmt.labelValue('master npub', summary.masterNpub),
    '',
    fmt.labelValue('mnemonic', fmt.wrapWords(mnemonic)),
    '',
    fmt.warning('Store this mnemonic offline. It cannot be recovered.'),
    '',
    fmt.nextSteps([
      'nsec-tree derive path personal',
      'nsec-tree profile save main --use',
    ]),
  ]
  if (savedProfile) {
    lines.splice(5, 0, fmt.labelValue('profile', savedProfile.name))
  }
  await printText(io, fmt.section(lines))
  return 0
}
```

- [ ] **Step 5: Refactor handleRoot — root restore / import-nsec**

Human mode output:

```js
if (!hasFlag(parsed, 'json') && !hasFlag(parsed, 'quiet')) {
  const title = subcommand === 'restore' ? 'Root restored' : 'Root imported'
  const lines = [
    fmt.boxHeader(title),
    '',
    fmt.labelValue('root type', summary.rootType),
    fmt.labelValue('recoverable', summary.recoverable ? 'yes' : 'no'),
    fmt.labelValue('master npub', summary.masterNpub),
  ]
  if (savedProfile) {
    lines.push(fmt.labelValue('profile', savedProfile.name))
  }
  if (rootSource.source) {
    lines.push(fmt.labelValue('source', rootSource.source))
  }
  lines.push('', fmt.nextSteps(['nsec-tree derive path personal']))
  await printText(io, fmt.section(lines))
  return 0
}
```

- [ ] **Step 6: Refactor handleRoot — root inspect**

```js
if (!hasFlag(parsed, 'json')) {
  const lines = [
    fmt.labelValue('root type', summary.rootType),
    fmt.labelValue('recoverable', summary.recoverable ? 'yes' : 'no'),
    fmt.labelValue('master npub', summary.masterNpub),
  ]
  if (rootSource.profileName) {
    lines.push(fmt.labelValue('profile', rootSource.profileName))
  }
  if (rootSource.source) {
    lines.push(fmt.labelValue('source', rootSource.source))
  }
  const caps = ['derive', 'export', 'prove']
  if (summary.recoverable) caps.push('phrase-backup', 'shamir')
  lines.push(fmt.labelValue('capabilities', caps.join(', ')))
  await printText(io, fmt.section(lines))
  return 0
}
```

- [ ] **Step 7: Refactor handleDerive**

Replace `formatDerivedPath` usage with formatter-based output:

```js
if (!hasFlag(parsed, 'json')) {
  const lines = [
    fmt.labelValue('root type', rootInfo.rootType),
    fmt.labelValue('path', result.normalizedPath),
    '',
    fmt.renderTree(result.segments),
    '',
    `  ${fmt.c.dim}No secret output. Use ${fmt.c.reset}${fmt.c.cyan}nsec-tree export nsec${fmt.c.reset}${fmt.c.dim} to extract the private key.${fmt.c.reset}`,
  ]
  await printText(io, fmt.section(lines))
  return 0
}
```

- [ ] **Step 8: Refactor handleExport**

Update the three subcommands (npub, nsec, identity) to use formatted output in human mode. Keep `--json` and `--quiet` unchanged.

For `export npub`:
```js
if (!hasFlag(parsed, 'json') && !hasFlag(parsed, 'quiet')) {
  await printText(io, fmt.section([
    fmt.labelValue('path', result.normalizedPath),
    fmt.labelValue('npub', result.identity.npub),
  ]))
}
```

For `export nsec` (human, non-quiet):
```js
if (!hasFlag(parsed, 'json') && !hasFlag(parsed, 'quiet')) {
  await printText(io, fmt.section([
    fmt.labelValue('path', result.normalizedPath),
    fmt.labelValue('nsec', result.identity.nsec),
    '',
    fmt.warning('This is a private key. Store it securely.'),
  ]))
}
```

For `export identity` (human):
```js
if (!hasFlag(parsed, 'json')) {
  await printText(io, fmt.section([
    fmt.labelValue('path', result.normalizedPath),
    fmt.labelValue('purpose', result.identity.purpose),
    fmt.labelValue('index', String(result.identity.index)),
    fmt.labelValue('npub', result.identity.npub),
    fmt.labelValue('nsec', result.identity.nsec),
    fmt.labelValue('public key', Buffer.from(result.identity.publicKey).toString('hex')),
    '',
    `  ${fmt.c.dim}This is a standalone Nostr identity.${fmt.c.reset}`,
  ]))
}
```

- [ ] **Step 9: Refactor handleProve**

```js
if (!hasFlag(parsed, 'json')) {
  const proofType = subcommand === 'private' ? 'private' : 'full'
  const lines = [
    fmt.labelValue('proof type', proofType),
    fmt.labelValue('master pubkey', proof.masterPubkey),
    fmt.labelValue('child pubkey', proof.childPubkey),
  ]
  if (proof.purpose !== undefined) {
    lines.push(fmt.labelValue('purpose', proof.purpose))
  }
  if (proof.index !== undefined) {
    lines.push(fmt.labelValue('index', String(proof.index)))
  }
  lines.push(
    fmt.labelValue('attestation', proof.attestation),
    fmt.labelValue('signature', proof.signature),
  )
  const explanation = proofType === 'private'
    ? 'This proof shows shared root ownership\n  without revealing how the child was derived.'
    : 'This proof reveals the full derivation path.\n  Anyone can verify the exact relationship.'
  lines.push('', `  ${fmt.c.dim}${explanation}${fmt.c.reset}`)
  await printText(io, fmt.section(lines))
}
```

- [ ] **Step 10: Refactor handleVerify**

Replace `formatVerification`. Preserve `return valid ? 0 : 1` after the formatting block — the exit code must still reflect proof validity:

```js
if (!hasFlag(parsed, 'json') && !hasFlag(parsed, 'quiet')) {
  if (valid) {
    const lines = [
      fmt.success('Proof is valid'),
      '',
      fmt.labelValue('proof type', proofType),
      fmt.labelValue('master pubkey', proof.masterPubkey),
      fmt.labelValue('child pubkey', proof.childPubkey),
    ]
    if (proof.purpose !== undefined) lines.push(fmt.labelValue('purpose', proof.purpose))
    if (proof.index !== undefined) lines.push(fmt.labelValue('index', String(proof.index)))
    await printText(io, fmt.section(lines))
  } else {
    await printText(io, fmt.failure('Proof is invalid'))
  }
}
```

- [ ] **Step 11: Refactor handleShamir — split**

```js
if (!hasFlag(parsed, 'json')) {
  const lines = [
    fmt.boxHeader('Shamir split complete'),
    '',
    fmt.labelValue('shares', String(shares)),
    fmt.labelValue('threshold', String(threshold)),
    '',
  ]
  for (const share of payload) {
    lines.push(fmt.labelValue(`share ${share.index}`, fmt.wrapWords(share.phrase)))
  }
  lines.push(
    '',
    fmt.warning(`Store each share separately. Any ${threshold} of ${shares} can recover the mnemonic.`),
  )
  await printText(io, fmt.section(lines))
}
```

- [ ] **Step 12: Refactor handleShamir — recover**

```js
if (!hasFlag(parsed, 'json')) {
  const lines = [
    fmt.boxHeader('Mnemonic recovered'),
    '',
    fmt.labelValue('root type', 'mnemonic-backed'),
    fmt.labelValue('recoverable', 'yes'),
    '',
    fmt.labelValue('mnemonic', fmt.wrapWords(mnemonic)),
    '',
    fmt.warning('Store this mnemonic offline. It cannot be recovered again without shares.'),
  ]
  await printText(io, fmt.section(lines))
}
```

- [ ] **Step 13: Refactor handleProfile**

Update `profile list` to use formatted output:

```js
if (!hasFlag(parsed, 'json')) {
  if (profiles.length === 0) {
    await printText(io, `  ${fmt.c.dim}No profiles saved yet.${fmt.c.reset}`)
  } else {
    const lines = profiles.map(p => {
      const prefix = p.active ? `${fmt.c.green}*${fmt.c.reset} ` : '  '
      const recovery = p.recoverable ? 'recoverable' : 'no recovery'
      return `  ${prefix}${fmt.c.bold}${p.name.padEnd(12)}${fmt.c.reset} ${p.rootType.padEnd(18)} ${fmt.c.dim}${recovery.padEnd(14)}${fmt.c.reset} ${fmt.c.cyan}${p.masterNpub}${fmt.c.reset}`
    })
    await printText(io, lines.join('\n'))
  }
}
```

Update `profile save`, `profile use`, `profile show`, `profile remove` similarly with `fmt.labelValue`.

- [ ] **Step 14: Refactor handleInspect**

Update `inspect path`:
```js
if (!hasFlag(parsed, 'json')) {
  const lines = [
    fmt.labelValue('path', payload.path),
    fmt.labelValue('deterministic', 'yes'),
    '',
    `  ${fmt.c.dim}segments:${fmt.c.reset}`,
    ...segments.map((seg, i) =>
      `    ${fmt.c.dim}${i + 1}.${fmt.c.reset} ${fmt.c.bold}${seg.name}${fmt.c.reset} ${fmt.c.dim}@ ${seg.requestedIndex}${fmt.c.reset}`
    ),
  ]
  await printText(io, fmt.section(lines))
}
```

Update `inspect root` — same pattern as `root inspect` but already shares the code path.

- [ ] **Step 15: Refactor handleExplain**

Replace the inline `explainTopic()` function call with the new module:

```js
async function handleExplain(parsed, io, fmt) {
  const topic = parsed.positionals[1]
  if (!topic) {
    throw new CliUsageError(`Explain topic is required. Topics: ${TOPIC_NAMES.join(', ')}`)
  }
  ensureNoExtraPositionals(parsed, 2)
  await printText(io, getExplainContent(topic, fmt))
  return 0
}
```

Remove the old `explainTopic()` function from cli.js entirely.

- [ ] **Step 16: Remove dead functions from cli.js**

Delete these functions that are now replaced by format.js:
- `formatRootSummary()`
- `formatDerivedPath()`
- `formatIdentityRecord()`
- `formatProof()`
- `formatVerification()`
- `formatProfileList()`
- `warnIfSensitive()` — replaced by `fmt.warning()` in the refactored output

Also remove all `await warnIfSensitive(io, ...)` calls from the handlers — the `fmt.warning()` lines in the refactored human-mode output now handle this messaging inline.

- [ ] **Step 17: Run all tests**

Run: `node --test`
Expected: existing tests in `test/cli.test.js` PASS. The JSON output is unchanged so existing tests should still work. If any test checks human-mode output strings exactly, update those assertions.

- [ ] **Step 18: Commit**

```bash
git add src/cli.js
git commit -m "refactor: use format and explain modules for rich CLI output"
```

---

### Task 5: Comprehensive Test Coverage

**Files:**
- Modify: `test/cli.test.js` — expand happy-path coverage
- Create: `test/errors.test.js` — error paths
- Create: `test/format.test.js` — already created in Task 2, extend if needed
- Create: `test/profile.test.js` — profile lifecycle

- [ ] **Step 0: Extract MemoryIo to test/helpers.js**

The `MemoryIo` class and the test mnemonic are used across all four test files. Extract them to avoid duplication:

```js
export class MemoryIo {
  constructor(stdinText = '', isStdoutTty = false) {
    this.stdinText = stdinText
    this.isStdoutTty = isStdoutTty
    this.stdoutBuffer = ''
    this.stderrBuffer = ''
  }
  async stdout(text) { this.stdoutBuffer += text }
  async stderr(text) { this.stderrBuffer += text }
  async readStdin() { return this.stdinText }
}

export const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
```

Update `test/cli.test.js` to import from `./helpers.js` and remove the inline `MemoryIo` class. The other new test files should also import from `./helpers.js`.

- [ ] **Step 1: Expand test/cli.test.js with missing command coverage**

Add tests for all commands not yet covered. Use the shared `MemoryIo` and `TEST_MNEMONIC` from `test/helpers.js`. All new tests use `--json` to assert on stable output (not formatted strings):

```js
it('shows help text and exits 0', async () => {
  const io = new MemoryIo()
  const exitCode = await runCli(['--help'], io)
  assert.equal(exitCode, 0)
  assert.match(io.stdoutBuffer, /nsec-tree CLI/)
  assert.match(io.stdoutBuffer, /explain model/)
})

it('shows help when no arguments given', async () => {
  const io = new MemoryIo()
  const exitCode = await runCli([], io)
  assert.equal(exitCode, 0)
  assert.match(io.stdoutBuffer, /nsec-tree CLI/)
})

it('restores a mnemonic-backed root', async () => {
  const io = new MemoryIo()
  const exitCode = await runCli(['root', 'restore', '--mnemonic', mnemonic, '--json'], io)
  assert.equal(exitCode, 0)
  const payload = JSON.parse(io.stdoutBuffer)
  assert.equal(payload.rootType, 'mnemonic-backed')
  assert.equal(payload.recoverable, true)
})

it('imports an nsec-backed root', async () => {
  // First get an nsec from a derived identity
  const deriveIo = new MemoryIo()
  await runCli(['export', 'nsec', 'personal', '--mnemonic', mnemonic, '--json'], deriveIo)
  const { nsec } = JSON.parse(deriveIo.stdoutBuffer)

  const io = new MemoryIo()
  const exitCode = await runCli(['root', 'import-nsec', '--nsec', nsec, '--json'], io)
  assert.equal(exitCode, 0)
  const payload = JSON.parse(io.stdoutBuffer)
  assert.equal(payload.rootType, 'nsec-backed')
  assert.equal(payload.recoverable, false)
})

it('inspects root from mnemonic', async () => {
  const io = new MemoryIo()
  const exitCode = await runCli(['root', 'inspect', '--mnemonic', mnemonic, '--json'], io)
  assert.equal(exitCode, 0)
  const payload = JSON.parse(io.stdoutBuffer)
  assert.equal(payload.rootType, 'mnemonic-backed')
  assert.match(payload.masterNpub, /^npub1/)
})

it('exports npub for a derived path', async () => {
  const io = new MemoryIo()
  const exitCode = await runCli(['export', 'npub', 'personal', '--mnemonic', mnemonic, '--json'], io)
  assert.equal(exitCode, 0)
  const payload = JSON.parse(io.stdoutBuffer)
  assert.match(payload.npub, /^npub1/)
  assert.equal(payload.path, 'personal@0')
})

it('exports full identity record', async () => {
  const io = new MemoryIo()
  const exitCode = await runCli(['export', 'identity', 'personal', '--mnemonic', mnemonic, '--json'], io)
  assert.equal(exitCode, 0)
  const payload = JSON.parse(io.stdoutBuffer)
  assert.match(payload.npub, /^npub1/)
  assert.match(payload.nsec, /^nsec1/)
  assert.equal(typeof payload.publicKey, 'string')
  assert.equal(payload.purpose, 'personal')
})

it('generates and verifies a full proof', async () => {
  const proofIo = new MemoryIo()
  await runCli(['prove', 'full', 'personal', '--mnemonic', mnemonic, '--json'], proofIo)
  assert.equal(proofIo.stderrBuffer, '')

  const verifyIo = new MemoryIo(proofIo.stdoutBuffer)
  const exitCode = await runCli(['verify', 'proof', '--stdin', '--json'], verifyIo)
  assert.equal(exitCode, 0)
  const payload = JSON.parse(verifyIo.stdoutBuffer)
  assert.equal(payload.valid, true)
  assert.equal(payload.proofType, 'full')
})

it('inspects a path without a root', async () => {
  const io = new MemoryIo()
  const exitCode = await runCli(['inspect', 'path', 'personal/forum-burner@2', '--json'], io)
  assert.equal(exitCode, 0)
  const payload = JSON.parse(io.stdoutBuffer)
  assert.equal(payload.path, 'personal@0/forum-burner@2')
  assert.equal(payload.deterministic, true)
})

it('inspects root from active profile', async () => {
  const profileBaseDir = await mkdtemp(join(tmpdir(), 'nsec-tree-cli-'))
  tempDirs.push(profileBaseDir)

  const saveIo = new MemoryIo()
  await runCli(['profile', 'save', 'test', '--mnemonic', mnemonic, '--use', '--json'], saveIo, { profileBaseDir })

  const io = new MemoryIo()
  const exitCode = await runCli(['inspect', 'root', '--json'], io, { profileBaseDir })
  assert.equal(exitCode, 0)
  const payload = JSON.parse(io.stdoutBuffer)
  assert.equal(payload.rootType, 'mnemonic-backed')
})

for (const topic of ['model', 'proofs', 'recovery', 'paths', 'offline']) {
  it(`explains ${topic} without error`, async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(['explain', topic], io)
    assert.equal(exitCode, 0)
    assert.ok(io.stdoutBuffer.length > 50)
  })
}

it('derives using persona alias', async () => {
  const io = new MemoryIo()
  const exitCode = await runCli(['derive', 'persona', 'personal', '--mnemonic', mnemonic, '--json'], io)
  assert.equal(exitCode, 0)
  const payload = JSON.parse(io.stdoutBuffer)
  assert.match(payload.npub, /^npub1/)
})

it('derives using account alias', async () => {
  const io = new MemoryIo()
  const exitCode = await runCli(['derive', 'account', 'personal', '--mnemonic', mnemonic, '--json'], io)
  assert.equal(exitCode, 0)
  const payload = JSON.parse(io.stdoutBuffer)
  assert.match(payload.npub, /^npub1/)
})
```

- [ ] **Step 2: Run expanded cli tests**

Run: `node --test test/cli.test.js`
Expected: all PASS

- [ ] **Step 3: Create test/errors.test.js**

```js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { runCli } from '../src/cli.js'

class MemoryIo {
  constructor(stdinText = '', isStdoutTty = false) {
    this.stdinText = stdinText
    this.isStdoutTty = isStdoutTty
    this.stdoutBuffer = ''
    this.stderrBuffer = ''
  }
  async stdout(text) { this.stdoutBuffer += text }
  async stderr(text) { this.stderrBuffer += text }
  async readStdin() { return this.stdinText }
}

const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

describe('error handling', () => {
  it('rejects unknown command', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(['banana'], io)
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /Unknown command/)
  })

  it('rejects unknown root subcommand', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(['root', 'banana'], io)
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /Unknown root subcommand/)
  })

  it('rejects unknown derive subcommand', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(['derive', 'banana'], io)
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /Supported derive subcommands/)
  })

  it('rejects unknown export subcommand', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(['export', 'banana'], io)
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /Supported export subcommands/)
  })

  it('rejects unknown prove subcommand', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(['prove', 'banana'], io)
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /Supported prove subcommands/)
  })

  it('rejects unknown shamir subcommand', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(['shamir', 'banana'], io)
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /Unknown shamir subcommand/)
  })

  it('rejects unknown profile subcommand', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(['profile', 'banana'], io)
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /Unknown profile subcommand/)
  })

  it('rejects unknown inspect subcommand', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(['inspect', 'banana'], io)
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /Unknown inspect subcommand/)
  })

  it('rejects unknown explain topic', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(['explain', 'banana'], io)
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /Unknown explain topic/)
  })

  it('rejects derive without path argument', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(['derive', 'path', '--mnemonic', mnemonic], io)
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /Path argument is required/)
  })

  it('rejects conflicting root sources', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli([
      'derive', 'path', 'personal',
      '--mnemonic', mnemonic,
      '--nsec', 'nsec1fake',
    ], io)
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /exactly one root input/)
  })

  it('rejects path with leading slash', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(['derive', 'path', '/personal', '--mnemonic', mnemonic], io)
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /must not start or end/)
  })

  it('rejects path with trailing slash', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(['derive', 'path', 'personal/', '--mnemonic', mnemonic], io)
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /must not start or end/)
  })

  it('rejects path with uppercase characters', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(['derive', 'path', 'Personal', '--mnemonic', mnemonic], io)
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /invalid/)
  })

  it('rejects shamir split without shares and threshold', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(['shamir', 'split', '--mnemonic', mnemonic], io)
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /requires --shares and --threshold/)
  })

  it('rejects shamir split on nsec-backed root', async () => {
    // Get an nsec first
    const deriveIo = new MemoryIo()
    await runCli(['export', 'nsec', 'personal', '--mnemonic', mnemonic, '--quiet'], deriveIo)
    const nsec = deriveIo.stdoutBuffer.trim()

    const io = new MemoryIo()
    const exitCode = await runCli([
      'shamir', 'split', '--nsec', nsec, '--shares', '3', '--threshold', '2',
    ], io)
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /nsec-backed/)
  })

  it('rejects profile save without name', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(['profile', 'save', '--mnemonic', mnemonic], io)
    assert.equal(exitCode, 1)
  })

  it('rejects profile name with uppercase', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(['profile', 'save', 'BadName', '--mnemonic', mnemonic], io)
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /lowercase/)
  })

  it('rejects duplicate profile save without --force', async () => {
    const { mkdtemp, rm } = await import('node:fs/promises')
    const { join } = await import('node:path')
    const { tmpdir } = await import('node:os')

    const profileBaseDir = await mkdtemp(join(tmpdir(), 'nsec-tree-cli-'))
    try {
      const io1 = new MemoryIo()
      await runCli(['profile', 'save', 'test', '--mnemonic', mnemonic, '--json'], io1, { profileBaseDir })
      assert.equal(JSON.parse(io1.stdoutBuffer).name, 'test')

      const io2 = new MemoryIo()
      const exitCode = await runCli(['profile', 'save', 'test', '--mnemonic', mnemonic], io2, { profileBaseDir })
      assert.equal(exitCode, 1)
      assert.match(io2.stderrBuffer, /already exists/)
    } finally {
      await rm(profileBaseDir, { recursive: true, force: true })
    }
  })

  it('rejects unknown option', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(['root', 'create', '--banana'], io)
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /Unknown option/)
  })

  it('rejects no root input when required', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(['derive', 'path', 'personal'], io)
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /No root input/)
  })
})
```

- [ ] **Step 4: Run error tests**

Run: `node --test test/errors.test.js`
Expected: all PASS

- [ ] **Step 5: Create test/profile.test.js**

```js
import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runCli } from '../src/cli.js'

class MemoryIo {
  constructor(stdinText = '', isStdoutTty = false) {
    this.stdinText = stdinText
    this.isStdoutTty = isStdoutTty
    this.stdoutBuffer = ''
    this.stderrBuffer = ''
  }
  async stdout(text) { this.stdoutBuffer += text }
  async stderr(text) { this.stderrBuffer += text }
  async readStdin() { return this.stdinText }
}

const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

const tempDirs = []

afterEach(async () => {
  while (tempDirs.length > 0) {
    await rm(tempDirs.pop(), { recursive: true, force: true })
  }
})

describe('profile lifecycle', () => {
  it('list returns empty array when no profiles exist', async () => {
    const profileBaseDir = await mkdtemp(join(tmpdir(), 'nsec-tree-cli-'))
    tempDirs.push(profileBaseDir)

    const io = new MemoryIo()
    const exitCode = await runCli(['profile', 'list', '--json'], io, { profileBaseDir })
    assert.equal(exitCode, 0)
    assert.deepStrictEqual(JSON.parse(io.stdoutBuffer), [])
  })

  it('save, list, show, use, remove full lifecycle', async () => {
    const profileBaseDir = await mkdtemp(join(tmpdir(), 'nsec-tree-cli-'))
    tempDirs.push(profileBaseDir)

    // Save
    const saveIo = new MemoryIo()
    await runCli(['profile', 'save', 'main', '--mnemonic', mnemonic, '--json'], saveIo, { profileBaseDir })
    const saved = JSON.parse(saveIo.stdoutBuffer)
    assert.equal(saved.name, 'main')

    // List shows one profile
    const listIo = new MemoryIo()
    await runCli(['profile', 'list', '--json'], listIo, { profileBaseDir })
    const list = JSON.parse(listIo.stdoutBuffer)
    assert.equal(list.length, 1)
    assert.equal(list[0].name, 'main')
    assert.equal(list[0].active, false)

    // Use
    const useIo = new MemoryIo()
    await runCli(['profile', 'use', 'main', '--json'], useIo, { profileBaseDir })

    // List shows active
    const list2Io = new MemoryIo()
    await runCli(['profile', 'list', '--json'], list2Io, { profileBaseDir })
    assert.equal(JSON.parse(list2Io.stdoutBuffer)[0].active, true)

    // Show (from active)
    const showIo = new MemoryIo()
    await runCli(['profile', 'show', '--json'], showIo, { profileBaseDir })
    const shown = JSON.parse(showIo.stdoutBuffer)
    assert.equal(shown.name, 'main')
    assert.equal(shown.rootType, 'mnemonic-backed')

    // Show (explicit name)
    const show2Io = new MemoryIo()
    await runCli(['profile', 'show', 'main', '--json'], show2Io, { profileBaseDir })
    assert.equal(JSON.parse(show2Io.stdoutBuffer).name, 'main')

    // Remove
    const removeIo = new MemoryIo()
    await runCli(['profile', 'remove', 'main', '--json'], removeIo, { profileBaseDir })
    assert.deepStrictEqual(JSON.parse(removeIo.stdoutBuffer), { removed: 'main' })

    // List is empty again
    const list3Io = new MemoryIo()
    await runCli(['profile', 'list', '--json'], list3Io, { profileBaseDir })
    assert.deepStrictEqual(JSON.parse(list3Io.stdoutBuffer), [])
  })

  it('removal of active profile clears active status', async () => {
    const profileBaseDir = await mkdtemp(join(tmpdir(), 'nsec-tree-cli-'))
    tempDirs.push(profileBaseDir)

    await runCli(['profile', 'save', 'main', '--mnemonic', mnemonic, '--use', '--json'], new MemoryIo(), { profileBaseDir })

    await runCli(['profile', 'remove', 'main', '--json'], new MemoryIo(), { profileBaseDir })

    // Deriving without explicit root should fail (no active profile)
    const io = new MemoryIo()
    const exitCode = await runCli(['derive', 'path', 'personal'], io, { profileBaseDir })
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /No root input/)
  })

  it('--force overwrites existing profile', async () => {
    const profileBaseDir = await mkdtemp(join(tmpdir(), 'nsec-tree-cli-'))
    tempDirs.push(profileBaseDir)

    await runCli(['profile', 'save', 'main', '--mnemonic', mnemonic, '--json'], new MemoryIo(), { profileBaseDir })

    const io = new MemoryIo()
    const exitCode = await runCli(['profile', 'save', 'main', '--mnemonic', mnemonic, '--force', '--json'], io, { profileBaseDir })
    assert.equal(exitCode, 0)
  })

  it('active profile is used for derive/export/prove', async () => {
    const profileBaseDir = await mkdtemp(join(tmpdir(), 'nsec-tree-cli-'))
    tempDirs.push(profileBaseDir)

    await runCli(['profile', 'save', 'main', '--mnemonic', mnemonic, '--use', '--json'], new MemoryIo(), { profileBaseDir })

    const deriveIo = new MemoryIo()
    const deriveExit = await runCli(['derive', 'path', 'personal', '--json'], deriveIo, { profileBaseDir })
    assert.equal(deriveExit, 0)
    assert.equal(JSON.parse(deriveIo.stdoutBuffer).profile, 'main')

    const exportIo = new MemoryIo()
    const exportExit = await runCli(['export', 'npub', 'personal', '--json'], exportIo, { profileBaseDir })
    assert.equal(exportExit, 0)

    const proveIo = new MemoryIo()
    const proveExit = await runCli(['prove', 'private', 'personal', '--json'], proveIo, { profileBaseDir })
    assert.equal(proveExit, 0)
  })
})
```

- [ ] **Step 6: Run profile tests**

Run: `node --test test/profile.test.js`
Expected: all PASS

- [ ] **Step 7: Add formatting-specific tests to test/format.test.js**

Extend the existing format.test.js with TTY/NO_COLOR integration tests that go through `runCli`. Note: use `{ concurrency: 1 }` because the NO_COLOR test mutates `process.env`:

```js
describe('CLI formatting integration', { concurrency: 1 }, () => {
  it('TTY mode includes ANSI codes in root create output', async () => {
    const io = new MemoryIo('', true) // isStdoutTty = true
    await runCli(['root', 'create'], io)
    assert.match(io.stdoutBuffer, /\x1b\[/)
    assert.match(io.stdoutBuffer, /╭/)
  })

  it('non-TTY mode excludes ANSI codes', async () => {
    const io = new MemoryIo('', false)
    await runCli(['root', 'create'], io)
    assert.doesNotMatch(io.stdoutBuffer, /\x1b\[/)
    assert.match(io.stdoutBuffer, /╭/) // box drawing still present
  })

  it('NO_COLOR disables ANSI even in TTY mode', async () => {
    const original = process.env.NO_COLOR
    process.env.NO_COLOR = '1'
    try {
      const io = new MemoryIo('', true)
      await runCli(['root', 'create'], io)
      assert.doesNotMatch(io.stdoutBuffer, /\x1b\[/)
    } finally {
      if (original === undefined) {
        delete process.env.NO_COLOR
      } else {
        process.env.NO_COLOR = original
      }
    }
  })

  it('--json output contains no ANSI codes', async () => {
    const io = new MemoryIo('', true)
    await runCli(['root', 'create', '--json'], io)
    assert.doesNotMatch(io.stdoutBuffer, /\x1b\[/)
    JSON.parse(io.stdoutBuffer) // valid JSON
  })

  it('--quiet output contains no ANSI codes', async () => {
    const io = new MemoryIo('', true)
    await runCli(['root', 'create', '--quiet'], io)
    assert.doesNotMatch(io.stdoutBuffer, /\x1b\[/)
    assert.doesNotMatch(io.stdoutBuffer, /╭/) // no box drawing
  })

  it('derive path shows tree-drawing characters', async () => {
    const io = new MemoryIo('', false)
    await runCli(['derive', 'path', 'personal/forum-burner', '--mnemonic', mnemonic], io)
    assert.match(io.stdoutBuffer, /└─/)
    assert.match(io.stdoutBuffer, /leaf/)
  })
})
```

Add the necessary imports at the top of the file (`import { runCli } from '../src/cli.js'` and the `MemoryIo` class and `mnemonic` constant).

- [ ] **Step 8: Run all tests**

Run: `node --test`
Expected: all tests across all four files PASS

- [ ] **Step 9: Commit**

```bash
git add test/
git commit -m "test: comprehensive coverage for commands, errors, profiles, formatting"
```

---

### Task 6: README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write the new README**

Replace the entire README with the developer-facing landing page. Use real command output from the CLI (run the commands to capture exact npubs). The README should feel like a product page, not internal docs.

Structure (from spec):
1. Opening: `npx nsec-tree root create`
2. One-paragraph pitch
3. "See it in action" — annotated terminal walkthrough
4. "Why hierarchical identity?" — teaching section
5. "Fully offline" — confidence-builder
6. "What can you do?" — command group reference
7. Install section
8. "Learn from the CLI" — explain commands
9. Footer — MIT, library links, NIP teaser

Voice: approachable and teaching. British English.

The README should be roughly 150-200 lines. Not a wall of text, not a stub. Every section earns its place.

- [ ] **Step 2: Verify all example commands in the README actually work**

Run each command shown in the README and confirm the output matches what's described. Fix any discrepancies.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README as developer-facing landing page"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `node --test`
Expected: all tests PASS across all four test files

- [ ] **Step 2: Test the npx experience**

Run: `node ./bin/nsec-tree.js root create`
Verify: rich formatted output with box header, colour (in TTY), mnemonic wrapping, next steps

Run: `node ./bin/nsec-tree.js explain model`
Verify: rich mini-tutorial with teaching content

Run: `node ./bin/nsec-tree.js explain offline`
Verify: offline-first value proposition

Run: `node ./bin/nsec-tree.js --help`
Verify: help text shows all commands including new explain topics

- [ ] **Step 3: Test JSON regression**

Run: `node ./bin/nsec-tree.js root create --json | node -e "process.stdin.on('data',d=>{const p=JSON.parse(d);console.log(Object.keys(p).sort().join(','))})"`
Expected: keys include `masterNpub,mnemonic,recoverable,rootType`

- [ ] **Step 4: Commit any final fixes**

If any issues found, fix and commit.

- [ ] **Step 5: Update CLAUDE.md**

Update the CLAUDE.md file to reflect the new file structure (format.js, explain.js), the npm dependency story, and the test file organisation. Remove references to the zero-dependency design.
