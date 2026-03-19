import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
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

describe('nsec-tree CLI', () => {
  it('--help returns help text and exit 0', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(['--help'], io)
    assert.equal(exitCode, 0)
    assert.match(io.stdoutBuffer, /explain model/)
    assert.match(io.stdoutBuffer, /Usage:/)
  })

  it('no arguments shows help and exits 0', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli([], io)
    assert.equal(exitCode, 0)
    assert.match(io.stdoutBuffer, /Usage:/)
  })

  it('creates a mnemonic-backed root in json mode', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(['root', 'create', '--json'], io)
    assert.equal(exitCode, 0)
    const payload = JSON.parse(io.stdoutBuffer)
    assert.equal(payload.rootType, 'mnemonic-backed')
    assert.equal(payload.recoverable, true)
    assert.match(payload.masterNpub, /^npub1/)
    assert.equal(typeof payload.mnemonic, 'string')
  })

  it('root restore --mnemonic returns mnemonic-backed', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(
      ['root', 'restore', '--mnemonic', TEST_MNEMONIC, '--json'],
      io,
    )
    assert.equal(exitCode, 0)
    const payload = JSON.parse(io.stdoutBuffer)
    assert.equal(payload.rootType, 'mnemonic-backed')
    assert.equal(payload.recoverable, true)
    assert.match(payload.masterNpub, /^npub1/)
  })

  it('root import-nsec --nsec returns nsec-backed', async () => {
    // First derive an nsec from the test mnemonic
    const exportIo = new MemoryIo()
    await runCli(
      ['export', 'nsec', 'personal', '--mnemonic', TEST_MNEMONIC, '--json'],
      exportIo,
    )
    const { nsec } = JSON.parse(exportIo.stdoutBuffer)

    const io = new MemoryIo()
    const exitCode = await runCli(
      ['root', 'import-nsec', '--nsec', nsec, '--json'],
      io,
    )
    assert.equal(exitCode, 0)
    const payload = JSON.parse(io.stdoutBuffer)
    assert.equal(payload.rootType, 'nsec-backed')
    assert.equal(payload.recoverable, false)
  })

  it('root inspect --mnemonic returns root info', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(
      ['root', 'inspect', '--mnemonic', TEST_MNEMONIC, '--json'],
      io,
    )
    assert.equal(exitCode, 0)
    const payload = JSON.parse(io.stdoutBuffer)
    assert.equal(payload.rootType, 'mnemonic-backed')
    assert.match(payload.masterNpub, /^npub1/)
    assert.equal(payload.source, 'explicit mnemonic')
  })

  it('derives a nested path from a mnemonic', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(
      ['derive', 'path', 'personal/forum-burner', '--mnemonic', TEST_MNEMONIC, '--json'],
      io,
    )
    assert.equal(exitCode, 0)
    const payload = JSON.parse(io.stdoutBuffer)
    assert.equal(payload.path, 'personal@0/forum-burner@0')
    assert.equal(payload.segments.length, 2)
    assert.match(payload.npub, /^npub1/)
  })

  it('derive persona alias works', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(
      ['derive', 'persona', 'personal', '--mnemonic', TEST_MNEMONIC, '--json'],
      io,
    )
    assert.equal(exitCode, 0)
    const payload = JSON.parse(io.stdoutBuffer)
    assert.equal(payload.path, 'personal@0')
    assert.match(payload.npub, /^npub1/)
  })

  it('derive account alias works', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(
      ['derive', 'account', 'personal', '--mnemonic', TEST_MNEMONIC, '--json'],
      io,
    )
    assert.equal(exitCode, 0)
    const payload = JSON.parse(io.stdoutBuffer)
    assert.equal(payload.path, 'personal@0')
  })

  it('export npub returns npub', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(
      ['export', 'npub', 'personal', '--mnemonic', TEST_MNEMONIC, '--json'],
      io,
    )
    assert.equal(exitCode, 0)
    const payload = JSON.parse(io.stdoutBuffer)
    assert.match(payload.npub, /^npub1/)
    assert.equal(payload.path, 'personal@0')
  })

  it('export identity returns full identity record', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(
      ['export', 'identity', 'personal', '--mnemonic', TEST_MNEMONIC, '--json'],
      io,
    )
    assert.equal(exitCode, 0)
    const payload = JSON.parse(io.stdoutBuffer)
    assert.match(payload.npub, /^npub1/)
    assert.match(payload.nsec, /^nsec1/)
    assert.equal(typeof payload.publicKey, 'string')
    assert.equal(payload.path, 'personal@0')
  })

  it('prove full + verify proof round-trip', async () => {
    const proveIo = new MemoryIo()
    const proveExit = await runCli(
      ['prove', 'full', 'personal', '--mnemonic', TEST_MNEMONIC, '--json'],
      proveIo,
    )
    assert.equal(proveExit, 0)

    const verifyIo = new MemoryIo(proveIo.stdoutBuffer)
    const verifyExit = await runCli(['verify', 'proof', '--stdin', '--json'], verifyIo)
    assert.equal(verifyExit, 0)
    const payload = JSON.parse(verifyIo.stdoutBuffer)
    assert.equal(payload.valid, true)
    assert.equal(payload.proofType, 'full')
  })

  it('proves and verifies a private proof through stdin', async () => {
    const proofIo = new MemoryIo()
    const proofExitCode = await runCli(
      ['prove', 'private', 'personal', '--mnemonic', TEST_MNEMONIC, '--json'],
      proofIo,
    )
    assert.equal(proofExitCode, 0)

    const verifyIo = new MemoryIo(proofIo.stdoutBuffer)
    const verifyExitCode = await runCli(['verify', 'proof', '--stdin', '--json'], verifyIo)
    assert.equal(verifyExitCode, 0)
    const payload = JSON.parse(verifyIo.stdoutBuffer)
    assert.equal(payload.valid, true)
    assert.equal(payload.proofType, 'private')
  })

  it('inspect path personal/forum-burner@2 returns correct path', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(
      ['inspect', 'path', 'personal/forum-burner@2', '--json'],
      io,
    )
    assert.equal(exitCode, 0)
    const payload = JSON.parse(io.stdoutBuffer)
    assert.equal(payload.path, 'personal@0/forum-burner@2')
    assert.equal(payload.segments.length, 2)
    assert.equal(payload.segments[1].requestedIndex, 2)
    assert.equal(payload.deterministic, true)
  })

  it('inspect root from active profile', async () => {
    const profileBaseDir = await mkdtemp(join(tmpdir(), 'nsec-tree-cli-'))
    tempDirs.push(profileBaseDir)

    // Save and activate a profile
    const saveIo = new MemoryIo()
    await runCli(
      ['profile', 'save', 'test-profile', '--mnemonic', TEST_MNEMONIC, '--use', '--json'],
      saveIo,
      { profileBaseDir },
    )

    // Inspect root without explicit source — should use active profile
    const io = new MemoryIo()
    const exitCode = await runCli(
      ['inspect', 'root', '--json'],
      io,
      { profileBaseDir },
    )
    assert.equal(exitCode, 0)
    const payload = JSON.parse(io.stdoutBuffer)
    assert.equal(payload.rootType, 'mnemonic-backed')
    assert.equal(payload.profile, 'test-profile')
  })

  it('splits and recovers a mnemonic via shamir-words', async () => {
    const splitIo = new MemoryIo()
    const splitExitCode = await runCli(
      ['shamir', 'split', '--mnemonic', TEST_MNEMONIC, '--shares', '3', '--threshold', '2', '--json'],
      splitIo,
    )
    assert.equal(splitExitCode, 0)
    const splitPayload = JSON.parse(splitIo.stdoutBuffer)
    assert.equal(splitPayload.shares.length, 3)

    const recoverStdin = `${splitPayload.shares[0].phrase}\n${splitPayload.shares[1].phrase}\n`
    const recoverIo = new MemoryIo(recoverStdin)
    const recoverExitCode = await runCli(['shamir', 'recover', '--stdin', '--json'], recoverIo)
    assert.equal(recoverExitCode, 0)
    const recoverPayload = JSON.parse(recoverIo.stdoutBuffer)
    assert.equal(recoverPayload.mnemonic, TEST_MNEMONIC)
  })

  it('saves and uses a local profile', async () => {
    const profileBaseDir = await mkdtemp(join(tmpdir(), 'nsec-tree-cli-'))
    tempDirs.push(profileBaseDir)

    const saveIo = new MemoryIo()
    const saveExitCode = await runCli(
      ['profile', 'save', 'personal', '--mnemonic', TEST_MNEMONIC, '--use', '--json'],
      saveIo,
      { profileBaseDir },
    )
    assert.equal(saveExitCode, 0)

    const deriveIo = new MemoryIo()
    const deriveExitCode = await runCli(
      ['derive', 'path', 'personal/forum-burner', '--json'],
      deriveIo,
      { profileBaseDir },
    )
    assert.equal(deriveExitCode, 0)
    const payload = JSON.parse(deriveIo.stdoutBuffer)
    assert.equal(payload.profile, 'personal')
  })

  it('writes root descriptors to disk', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'nsec-tree-cli-'))
    tempDirs.push(directory)
    const outputFile = join(directory, 'root.json')
    const io = new MemoryIo()

    const exitCode = await runCli(
      ['root', 'restore', '--mnemonic', TEST_MNEMONIC, '--out', outputFile, '--json'],
      io,
    )
    assert.equal(exitCode, 0)

    const descriptor = JSON.parse(await readFile(outputFile, 'utf8'))
    assert.equal(descriptor.type, 'mnemonic-backed')
    assert.equal(descriptor.mnemonic, TEST_MNEMONIC)
  })

  for (const topic of ['model', 'proofs', 'recovery', 'paths', 'offline']) {
    it(`explain ${topic} exits 0 with substantial output`, async () => {
      const io = new MemoryIo()
      const exitCode = await runCli(['explain', topic], io)
      assert.equal(exitCode, 0)
      assert.ok(io.stdoutBuffer.length > 100, `explain ${topic} should produce substantial output`)
    })
  }
})

describe('contextual next-steps (HATEOAS)', () => {
  it('root create without profile shows copy-paste profile save command with mnemonic', async () => {
    const io = new MemoryIo('', false)
    const exitCode = await runCli(['root', 'create'], io)
    assert.equal(exitCode, 0)
    assert.match(io.stdoutBuffer, /profile save main --mnemonic "/, 'should show profile save with actual mnemonic')
  })

  it('root create with --name shows derive/export suggestions', async () => {
    const profileBaseDir = await mkdtemp(join(tmpdir(), 'nsec-tree-cli-'))
    tempDirs.push(profileBaseDir)

    const io = new MemoryIo('', false)
    const exitCode = await runCli(
      ['root', 'create', '--name', 'main'],
      io,
      { profileBaseDir },
    )
    assert.equal(exitCode, 0)
    assert.match(io.stdoutBuffer, /derive path personal/, 'should suggest derive path')
    assert.match(io.stdoutBuffer, /export nsec personal/, 'should suggest export nsec')
    assert.doesNotMatch(io.stdoutBuffer, /profile save/, 'should not show profile save when --name was used')
  })

  it('derive output includes path in export hint', async () => {
    const io = new MemoryIo('', false)
    const exitCode = await runCli(
      ['derive', 'path', 'personal/forum-burner', '--mnemonic', TEST_MNEMONIC],
      io,
    )
    assert.equal(exitCode, 0)
    assert.match(io.stdoutBuffer, /export nsec personal\/forum-burner/, 'derive hint should include the derived path')
  })

  it('profile save shows storage path in output', async () => {
    const profileBaseDir = await mkdtemp(join(tmpdir(), 'nsec-tree-cli-'))
    tempDirs.push(profileBaseDir)

    const io = new MemoryIo('', false)
    const exitCode = await runCli(
      ['profile', 'save', 'test-profile', '--mnemonic', TEST_MNEMONIC],
      io,
      { profileBaseDir },
    )
    assert.equal(exitCode, 0)
    assert.match(io.stdoutBuffer, /stored at/, 'profile save should show storage path')
    assert.match(io.stdoutBuffer, /test-profile\.json/, 'storage path should include the profile filename')
  })

  it('verify proof shows explain proofs hint', async () => {
    const proveIo = new MemoryIo('', false)
    await runCli(
      ['prove', 'private', 'personal', '--mnemonic', TEST_MNEMONIC, '--json'],
      proveIo,
    )

    const verifyIo = new MemoryIo(proveIo.stdoutBuffer, false)
    const exitCode = await runCli(['verify', 'proof', '--stdin'], verifyIo)
    assert.equal(exitCode, 0)
    assert.match(verifyIo.stdoutBuffer, /explain proofs/, 'verify should suggest explain proofs')
  })
})
