import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import process from 'node:process'
import { createFormatter } from '../src/format.js'
import { runCli } from '../src/cli.js'
import { MemoryIo, TEST_MNEMONIC } from './helpers.js'

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
      assert.match(result, /\x1b\[33m/)
      assert.match(result, /Store this mnemonic offline/)
    })

    it('renders success with green checkmark', () => {
      const result = fmt.success('Proof is valid')
      assert.match(result, /\x1b\[32m/)
      assert.match(result, /Proof is valid/)
    })

    it('renders failure with red cross', () => {
      const result = fmt.failure('Proof is invalid')
      assert.match(result, /\x1b\[31m/)
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

describe('CLI formatting integration', { concurrency: 1 }, () => {
  let savedNoColor

  afterEach(() => {
    if (savedNoColor === undefined) {
      delete process.env.NO_COLOR
    } else {
      process.env.NO_COLOR = savedNoColor
    }
  })

  it('TTY mode output contains ANSI escape codes and box-drawing', async () => {
    const io = new MemoryIo('', true)
    const exitCode = await runCli(['root', 'create'], io)
    assert.equal(exitCode, 0)
    assert.match(io.stdoutBuffer, /\x1b\[/, 'TTY output should contain ANSI codes')
    assert.match(io.stdoutBuffer, /╭/, 'TTY output should contain box-drawing')
  })

  it('non-TTY mode output has no ANSI codes but still has box-drawing', async () => {
    const io = new MemoryIo('', false)
    const exitCode = await runCli(['root', 'create'], io)
    assert.equal(exitCode, 0)
    assert.doesNotMatch(io.stdoutBuffer, /\x1b\[/, 'non-TTY output should not contain ANSI codes')
    assert.match(io.stdoutBuffer, /╭/, 'non-TTY output should still have box-drawing')
  })

  it('NO_COLOR=1 disables ANSI even in TTY', async () => {
    savedNoColor = process.env.NO_COLOR
    process.env.NO_COLOR = '1'

    const io = new MemoryIo('', true)
    const exitCode = await runCli(['root', 'create'], io)
    assert.equal(exitCode, 0)
    assert.doesNotMatch(io.stdoutBuffer, /\x1b\[/, 'NO_COLOR should suppress ANSI codes')
  })

  it('--json output contains no ANSI codes and is valid JSON', async () => {
    const io = new MemoryIo('', true)
    const exitCode = await runCli(
      ['derive', 'path', 'personal', '--mnemonic', TEST_MNEMONIC, '--json'],
      io,
    )
    assert.equal(exitCode, 0)
    assert.doesNotMatch(io.stdoutBuffer, /\x1b\[/, '--json output should not contain ANSI codes')
    const parsed = JSON.parse(io.stdoutBuffer)
    assert.equal(typeof parsed.path, 'string')
  })

  it('--quiet output has no ANSI codes and no box-drawing', async () => {
    const io = new MemoryIo('', true)
    const exitCode = await runCli(
      ['root', 'create', '--quiet'],
      io,
    )
    assert.equal(exitCode, 0)
    assert.doesNotMatch(io.stdoutBuffer, /\x1b\[/, '--quiet should not contain ANSI codes')
    assert.doesNotMatch(io.stdoutBuffer, /╭/, '--quiet should not have box-drawing')
  })

  it('derive path shows tree-drawing characters and leaf marker', async () => {
    const io = new MemoryIo('', false)
    const exitCode = await runCli(
      ['derive', 'path', 'personal/forum-burner', '--mnemonic', TEST_MNEMONIC],
      io,
    )
    assert.equal(exitCode, 0)
    assert.match(io.stdoutBuffer, /└─/, 'output should contain tree-drawing characters')
    assert.match(io.stdoutBuffer, /\(leaf\)/, 'output should mark the leaf node')
  })
})
