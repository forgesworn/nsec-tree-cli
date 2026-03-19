import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runCli } from '../src/cli.js'
import { MemoryIo, TEST_MNEMONIC } from './helpers.js'

const tempDirs = []

afterEach(async () => {
  while (tempDirs.length > 0) {
    const path = tempDirs.pop()
    await rm(path, { recursive: true, force: true })
  }
})

describe('error paths', () => {
  it('unknown command exits 1 with "Unknown command"', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(['banana'], io)
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /Unknown command/)
  })

  it('unknown root subcommand exits 1', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(['root', 'banana'], io)
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /Unknown root subcommand/)
  })

  it('unknown derive subcommand exits 1', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(['derive', 'banana'], io)
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /Supported derive subcommands/)
  })

  it('unknown export subcommand exits 1', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(['export', 'banana', 'personal', '--mnemonic', TEST_MNEMONIC], io)
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /Supported export subcommands/)
  })

  it('unknown prove subcommand exits 1', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(['prove', 'banana', 'personal', '--mnemonic', TEST_MNEMONIC], io)
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /Supported prove subcommands/)
  })

  it('unknown shamir subcommand exits 1', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(['shamir', 'banana'], io)
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /Unknown shamir subcommand/)
  })

  it('unknown profile subcommand exits 1', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(['profile', 'banana'], io)
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /Unknown profile subcommand/)
  })

  it('unknown inspect subcommand exits 1', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(['inspect', 'banana'], io)
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /Unknown inspect subcommand/)
  })

  it('unknown explain topic exits 1', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(['explain', 'banana'], io)
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /Unknown explain topic/)
  })

  it('missing path for derive exits 1', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(['derive', 'path', '--mnemonic', TEST_MNEMONIC], io)
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /Path argument is required/)
  })

  it('conflicting root sources --mnemonic + --nsec exits 1', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(
      ['derive', 'path', 'personal', '--mnemonic', TEST_MNEMONIC, '--nsec', 'nsec1fake'],
      io,
    )
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /exactly one root input/)
  })

  it('path with leading slash exits 1', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(
      ['derive', 'path', '/personal', '--mnemonic', TEST_MNEMONIC],
      io,
    )
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /must not start or end/)
  })

  it('path with trailing slash exits 1', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(
      ['derive', 'path', 'personal/', '--mnemonic', TEST_MNEMONIC],
      io,
    )
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /must not start or end/)
  })

  it('path with uppercase exits 1', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(
      ['derive', 'path', 'Personal', '--mnemonic', TEST_MNEMONIC],
      io,
    )
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /invalid/)
  })

  it('shamir split without --shares/--threshold exits 1', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(
      ['shamir', 'split', '--mnemonic', TEST_MNEMONIC],
      io,
    )
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /requires --shares and --threshold/)
  })

  it('shamir split on nsec-backed root exits 1', async () => {
    // First get an nsec
    const exportIo = new MemoryIo()
    await runCli(
      ['export', 'nsec', 'personal', '--mnemonic', TEST_MNEMONIC, '--json'],
      exportIo,
    )
    const { nsec } = JSON.parse(exportIo.stdoutBuffer)

    const io = new MemoryIo()
    const exitCode = await runCli(
      ['shamir', 'split', '--nsec', nsec, '--shares', '3', '--threshold', '2'],
      io,
    )
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /nsec-backed/)
  })

  it('profile save without name exits 1', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(
      ['profile', 'save', '--mnemonic', TEST_MNEMONIC],
      io,
    )
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /profile save requires a profile name/)
  })

  it('profile name with uppercase exits 1', async () => {
    const profileBaseDir = await mkdtemp(join(tmpdir(), 'nsec-tree-cli-'))
    tempDirs.push(profileBaseDir)

    const io = new MemoryIo()
    const exitCode = await runCli(
      ['profile', 'save', 'MyProfile', '--mnemonic', TEST_MNEMONIC],
      io,
      { profileBaseDir },
    )
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /lowercase/)
  })

  it('duplicate profile save without --force exits 1 and suggests --force', async () => {
    const profileBaseDir = await mkdtemp(join(tmpdir(), 'nsec-tree-cli-'))
    tempDirs.push(profileBaseDir)

    // Save once
    const saveIo = new MemoryIo()
    await runCli(
      ['profile', 'save', 'test', '--mnemonic', TEST_MNEMONIC, '--json'],
      saveIo,
      { profileBaseDir },
    )

    // Attempt duplicate without --force
    const io = new MemoryIo()
    const exitCode = await runCli(
      ['profile', 'save', 'test', '--mnemonic', TEST_MNEMONIC],
      io,
      { profileBaseDir },
    )
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /already exists/, 'error should mention profile already exists')
    assert.match(io.stderrBuffer, /--force/, 'error should suggest --force to overwrite')
  })

  it('unknown option --banana exits 1', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(['root', 'create', '--banana'], io)
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /Unknown option/)
  })

  it('no root input when required exits 1', async () => {
    const profileBaseDir = await mkdtemp(join(tmpdir(), 'nsec-tree-cli-'))
    tempDirs.push(profileBaseDir)

    const io = new MemoryIo()
    const exitCode = await runCli(
      ['derive', 'path', 'personal'],
      io,
      { profileBaseDir },
    )
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /No root input/)
  })
})

describe('security regression', () => {
  it('rejects path traversal in profile names', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(
      ['profile', 'save', '../../../tmp/evil', '--mnemonic', TEST_MNEMONIC],
      io,
    )
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /lowercase/)
  })

  it('rejects null bytes in path segments', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(
      ['derive', 'path', 'personal\x00evil', '--mnemonic', TEST_MNEMONIC],
      io,
    )
    assert.equal(exitCode, 1)
  })

  it('rejects malformed JSON in proof verification', async () => {
    const io = new MemoryIo('not json at all')
    const exitCode = await runCli(['verify', 'proof', '--stdin'], io)
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /Invalid proof JSON/)
  })

  it('rejects empty stdin for proof verification', async () => {
    const io = new MemoryIo('')
    const exitCode = await runCli(['verify', 'proof', '--stdin'], io)
    assert.equal(exitCode, 1)
  })

  it('rejects --shares 0', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(
      ['shamir', 'split', '--mnemonic', TEST_MNEMONIC, '--shares', '0', '--threshold', '0'],
      io,
    )
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /between 2 and 255/)
  })

  it('rejects --shares -1', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(
      ['shamir', 'split', '--mnemonic', TEST_MNEMONIC, '--shares', '-1', '--threshold', '2'],
      io,
    )
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /between 2 and 255/)
  })

  it('rejects --threshold greater than --shares', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(
      ['shamir', 'split', '--mnemonic', TEST_MNEMONIC, '--shares', '3', '--threshold', '5'],
      io,
    )
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /between 2 and 3/)
  })

  it('profile show --json does not leak root descriptor', async () => {
    const profileBaseDir = await mkdtemp(join(tmpdir(), 'nsec-tree-cli-'))
    tempDirs.push(profileBaseDir)

    await runCli(
      ['profile', 'save', 'test', '--mnemonic', TEST_MNEMONIC, '--use', '--json'],
      new MemoryIo(),
      { profileBaseDir },
    )

    const io = new MemoryIo()
    await runCli(['profile', 'show', '--json'], io, { profileBaseDir })
    const payload = JSON.parse(io.stdoutBuffer)
    assert.equal(payload.root, undefined, 'profile show --json should not include root descriptor')
    assert.equal(payload.name, 'test')
    assert.match(payload.masterNpub, /^npub1/)
  })
})
