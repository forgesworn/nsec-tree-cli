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

describe('profile lifecycle', () => {
  it('empty profile list returns []', async () => {
    const profileBaseDir = await mkdtemp(join(tmpdir(), 'nsec-tree-cli-'))
    tempDirs.push(profileBaseDir)

    const io = new MemoryIo()
    const exitCode = await runCli(['profile', 'list', '--json'], io, { profileBaseDir })
    assert.equal(exitCode, 0)
    const payload = JSON.parse(io.stdoutBuffer)
    assert.deepStrictEqual(payload, [])
  })

  it('full save -> list -> show -> use -> remove lifecycle', async () => {
    const profileBaseDir = await mkdtemp(join(tmpdir(), 'nsec-tree-cli-'))
    tempDirs.push(profileBaseDir)

    // Save
    const saveIo = new MemoryIo()
    const saveExit = await runCli(
      ['profile', 'save', 'main', '--mnemonic', TEST_MNEMONIC, '--json'],
      saveIo,
      { profileBaseDir },
    )
    assert.equal(saveExit, 0)
    const saved = JSON.parse(saveIo.stdoutBuffer)
    assert.equal(saved.name, 'main')
    assert.equal(saved.rootType, 'mnemonic-backed')

    // List
    const listIo = new MemoryIo()
    const listExit = await runCli(['profile', 'list', '--json'], listIo, { profileBaseDir })
    assert.equal(listExit, 0)
    const profiles = JSON.parse(listIo.stdoutBuffer)
    assert.equal(profiles.length, 1)
    assert.equal(profiles[0].name, 'main')
    assert.equal(profiles[0].active, false)

    // Show
    const showIo = new MemoryIo()
    const showExit = await runCli(['profile', 'show', 'main', '--json'], showIo, { profileBaseDir })
    assert.equal(showExit, 0)
    const shown = JSON.parse(showIo.stdoutBuffer)
    assert.equal(shown.name, 'main')
    assert.equal(shown.rootType, 'mnemonic-backed')

    // Use
    const useIo = new MemoryIo()
    const useExit = await runCli(['profile', 'use', 'main', '--json'], useIo, { profileBaseDir })
    assert.equal(useExit, 0)
    const used = JSON.parse(useIo.stdoutBuffer)
    assert.equal(used.activeProfile, 'main')

    // Verify active in list
    const listIo2 = new MemoryIo()
    await runCli(['profile', 'list', '--json'], listIo2, { profileBaseDir })
    const profiles2 = JSON.parse(listIo2.stdoutBuffer)
    assert.equal(profiles2[0].active, true)

    // Remove
    const rmIo = new MemoryIo()
    const rmExit = await runCli(['profile', 'remove', 'main', '--json'], rmIo, { profileBaseDir })
    assert.equal(rmExit, 0)
    const removed = JSON.parse(rmIo.stdoutBuffer)
    assert.equal(removed.removed, 'main')

    // Verify empty after removal
    const listIo3 = new MemoryIo()
    await runCli(['profile', 'list', '--json'], listIo3, { profileBaseDir })
    const profiles3 = JSON.parse(listIo3.stdoutBuffer)
    assert.deepStrictEqual(profiles3, [])
  })

  it('removal of active profile clears active status', async () => {
    const profileBaseDir = await mkdtemp(join(tmpdir(), 'nsec-tree-cli-'))
    tempDirs.push(profileBaseDir)

    // Save and activate
    await runCli(
      ['profile', 'save', 'ephemeral', '--mnemonic', TEST_MNEMONIC, '--use', '--json'],
      new MemoryIo(),
      { profileBaseDir },
    )

    // Remove the active profile
    await runCli(
      ['profile', 'remove', 'ephemeral', '--json'],
      new MemoryIo(),
      { profileBaseDir },
    )

    // Derive should fail — no active profile and no explicit root
    const io = new MemoryIo()
    const exitCode = await runCli(
      ['derive', 'path', 'personal'],
      io,
      { profileBaseDir },
    )
    assert.equal(exitCode, 1)
    assert.match(io.stderrBuffer, /No root input/)
  })

  it('--force overwrites existing profile', async () => {
    const profileBaseDir = await mkdtemp(join(tmpdir(), 'nsec-tree-cli-'))
    tempDirs.push(profileBaseDir)

    // Save initial
    await runCli(
      ['profile', 'save', 'overwrite-me', '--mnemonic', TEST_MNEMONIC, '--json'],
      new MemoryIo(),
      { profileBaseDir },
    )

    // Save again with --force
    const io = new MemoryIo()
    const exitCode = await runCli(
      ['profile', 'save', 'overwrite-me', '--mnemonic', TEST_MNEMONIC, '--force', '--json'],
      io,
      { profileBaseDir },
    )
    assert.equal(exitCode, 0)
    const payload = JSON.parse(io.stdoutBuffer)
    assert.equal(payload.name, 'overwrite-me')
  })

  it('active profile used for derive/export/prove', async () => {
    const profileBaseDir = await mkdtemp(join(tmpdir(), 'nsec-tree-cli-'))
    tempDirs.push(profileBaseDir)

    // Save and activate
    await runCli(
      ['profile', 'save', 'active-test', '--mnemonic', TEST_MNEMONIC, '--use', '--json'],
      new MemoryIo(),
      { profileBaseDir },
    )

    // Derive without explicit root — should use active profile
    const deriveIo = new MemoryIo()
    const deriveExit = await runCli(
      ['derive', 'path', 'personal', '--json'],
      deriveIo,
      { profileBaseDir },
    )
    assert.equal(deriveExit, 0)
    const derived = JSON.parse(deriveIo.stdoutBuffer)
    assert.equal(derived.profile, 'active-test')

    // Export without explicit root
    const exportIo = new MemoryIo()
    const exportExit = await runCli(
      ['export', 'npub', 'personal', '--json'],
      exportIo,
      { profileBaseDir },
    )
    assert.equal(exportExit, 0)
    assert.match(JSON.parse(exportIo.stdoutBuffer).npub, /^npub1/)

    // Prove without explicit root
    const proveIo = new MemoryIo()
    const proveExit = await runCli(
      ['prove', 'private', 'personal', '--json'],
      proveIo,
      { profileBaseDir },
    )
    assert.equal(proveExit, 0)
  })
})
