import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
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

  async stdout(text) {
    this.stdoutBuffer += text
  }

  async stderr(text) {
    this.stderrBuffer += text
  }

  async readStdin() {
    return this.stdinText
  }
}

const tempDirs = []

afterEach(async () => {
  while (tempDirs.length > 0) {
    const path = tempDirs.pop()
    await rm(path, { recursive: true, force: true })
  }
})

describe('nsec-tree CLI', () => {
  const mnemonic =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

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

  it('derives a nested path from a mnemonic', async () => {
    const io = new MemoryIo()
    const exitCode = await runCli(
      ['derive', 'path', 'personal/forum-burner', '--mnemonic', mnemonic, '--json'],
      io,
    )
    assert.equal(exitCode, 0)
    const payload = JSON.parse(io.stdoutBuffer)
    assert.equal(payload.path, 'personal@0/forum-burner@0')
    assert.equal(payload.segments.length, 2)
    assert.match(payload.npub, /^npub1/)
  })

  it('proves and verifies a private proof through stdin', async () => {
    const proofIo = new MemoryIo()
    const proofExitCode = await runCli(
      ['prove', 'private', 'personal', '--mnemonic', mnemonic, '--json'],
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

  it('splits and recovers a mnemonic via shamir-words', async () => {
    const splitIo = new MemoryIo()
    const splitExitCode = await runCli(
      ['shamir', 'split', '--mnemonic', mnemonic, '--shares', '3', '--threshold', '2', '--json'],
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
    assert.equal(recoverPayload.mnemonic, mnemonic)
  })

  it('saves and uses a local profile', async () => {
    const profileBaseDir = await mkdtemp(join(tmpdir(), 'nsec-tree-cli-'))
    tempDirs.push(profileBaseDir)

    const saveIo = new MemoryIo()
    const saveExitCode = await runCli(
      ['profile', 'save', 'personal', '--mnemonic', mnemonic, '--use', '--json'],
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
      ['root', 'restore', '--mnemonic', mnemonic, '--out', outputFile, '--json'],
      io,
    )
    assert.equal(exitCode, 0)

    const descriptor = JSON.parse(await readFile(outputFile, 'utf8'))
    assert.equal(descriptor.type, 'mnemonic-backed')
    assert.equal(descriptor.mnemonic, mnemonic)
  })
})
