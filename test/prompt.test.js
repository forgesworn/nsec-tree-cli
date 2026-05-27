import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { runCli } from '../src/cli.js'
import { MemoryIo, TEST_MNEMONIC } from './helpers.js'

async function deriveTestNsec() {
  const io = new MemoryIo()
  await runCli(
    ['export', 'nsec', 'personal', '--mnemonic', TEST_MNEMONIC, '--json'],
    io,
  )
  return JSON.parse(io.stdoutBuffer).nsec
}

describe('interactive secret prompting', () => {
  it('bare --mnemonic prompts and consumes the answer', async () => {
    const io = new MemoryIo()
    io.secretAnswers = [TEST_MNEMONIC]
    const exitCode = await runCli(
      ['root', 'restore', '--mnemonic', '--json'],
      io,
    )
    assert.equal(exitCode, 0, io.stderrBuffer)
    assert.deepEqual(io.promptedLabels, ['mnemonic: '])
    const payload = JSON.parse(io.stdoutBuffer)
    assert.equal(payload.rootType, 'mnemonic-backed')
    assert.match(payload.masterNpub, /^npub1/)
  })

  it('bare --nsec prompts and consumes the answer', async () => {
    const nsec = await deriveTestNsec()
    const io = new MemoryIo()
    io.secretAnswers = [nsec]
    const exitCode = await runCli(
      ['root', 'import-nsec', '--nsec', '--json'],
      io,
    )
    assert.equal(exitCode, 0, io.stderrBuffer)
    assert.deepEqual(io.promptedLabels, ['nsec: '])
    const payload = JSON.parse(io.stdoutBuffer)
    assert.equal(payload.rootType, 'nsec-backed')
  })

  it('bare --mnemonic followed by another flag still prompts (not parsed as value)', async () => {
    const io = new MemoryIo()
    io.secretAnswers = [TEST_MNEMONIC]
    const exitCode = await runCli(
      ['derive', 'path', 'personal', '--mnemonic', '--json'],
      io,
    )
    assert.equal(exitCode, 0, io.stderrBuffer)
    assert.deepEqual(io.promptedLabels, ['mnemonic: '])
    const payload = JSON.parse(io.stdoutBuffer)
    assert.equal(payload.path, 'personal@0')
  })

  it('bare --nsec is treated as a root source for conflict detection', async () => {
    const io = new MemoryIo()
    io.secretAnswers = ['nsec1ignored']
    const exitCode = await runCli(
      ['derive', 'path', 'personal', '--nsec', '--mnemonic', TEST_MNEMONIC],
      io,
    )
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /exactly one root input/)
    assert.deepEqual(io.promptedLabels, [], 'should not prompt when conflict is detected first')
  })

  it('empty prompt answer exits 1 with a clear error', async () => {
    const io = new MemoryIo()
    io.secretAnswers = ['']
    const exitCode = await runCli(
      ['root', 'restore', '--mnemonic'],
      io,
    )
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /No value entered/)
  })

  it('bare --passphrase prompts together with --mnemonic', async () => {
    const io = new MemoryIo()
    io.secretAnswers = [TEST_MNEMONIC, 'my-passphrase']
    const exitCode = await runCli(
      ['root', 'restore', '--mnemonic', '--passphrase', '--json'],
      io,
    )
    assert.equal(exitCode, 0, io.stderrBuffer)
    assert.deepEqual(io.promptedLabels, ['mnemonic: ', 'passphrase: '])
  })

  it('explicit --mnemonic value still works (regression)', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(
      ['root', 'restore', '--mnemonic', TEST_MNEMONIC, '--json'],
      io,
    )
    assert.equal(exitCode, 0)
    assert.deepEqual(io.promptedLabels, [], 'no prompt when value is supplied')
  })

  it('--mnemonic= (inline empty value) does not prompt', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(
      ['root', 'restore', '--mnemonic='],
      io,
    )
    assert.equal(exitCode, 1)
    assert.deepEqual(io.promptedLabels, [])
  })

  it('help text documents interactive prompting', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(['--help'], io)
    assert.equal(exitCode, 0)
    assert.match(io.stdoutBuffer, /no value to be prompted/)
    assert.match(io.stdoutBuffer, /shell history/)
  })
})
