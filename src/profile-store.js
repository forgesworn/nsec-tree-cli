import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

const PROFILE_NAME_RE = /^[a-z0-9][a-z0-9-]{0,31}$/

function validateProfileName(name) {
  if (!PROFILE_NAME_RE.test(name)) {
    throw new Error(
      'Profile names must be lowercase letters, numbers, or hyphens, start with a letter or number, and be at most 32 characters',
    )
  }
}

function getBaseDir(options = {}) {
  return options.baseDir ?? join(homedir(), '.nsec-tree')
}

function getProfilesDir(options = {}) {
  return join(getBaseDir(options), 'profiles')
}

function getActiveFile(options = {}) {
  return join(getBaseDir(options), 'active-profile')
}

function getProfileFile(name, options = {}) {
  return join(getProfilesDir(options), `${name}.json`)
}

async function ensureDirs(options = {}) {
  await mkdir(getBaseDir(options), { recursive: true, mode: 0o700 })
  await mkdir(getProfilesDir(options), { recursive: true, mode: 0o700 })
}

async function pathExists(path) {
  try {
    await readFile(path, 'utf8')
    return true
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return false
    }
    throw error
  }
}

export function coerceRootDescriptor(value) {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Root descriptor must be an object')
  }

  const candidate = value.root && typeof value.root === 'object' ? value.root : value
  if (candidate.type !== 'mnemonic-backed' && candidate.type !== 'nsec-backed') {
    throw new Error('Root descriptor type must be "mnemonic-backed" or "nsec-backed"')
  }

  if (candidate.type === 'mnemonic-backed') {
    if (typeof candidate.mnemonic !== 'string') {
      throw new Error('Mnemonic-backed root descriptor must include a mnemonic string')
    }
    if (candidate.passphrase !== undefined && typeof candidate.passphrase !== 'string') {
      throw new Error('Mnemonic-backed passphrase must be a string')
    }
    return {
      type: 'mnemonic-backed',
      mnemonic: candidate.mnemonic,
      passphrase: candidate.passphrase,
    }
  }

  if (typeof candidate.nsec !== 'string') {
    throw new Error('nsec-backed root descriptor must include an nsec string')
  }

  return {
    type: 'nsec-backed',
    nsec: candidate.nsec,
  }
}

export async function describeRoot(libraries, descriptor) {
  const { fromMnemonic, fromNsec } = libraries.nsecTree
  const root =
    descriptor.type === 'mnemonic-backed'
      ? fromMnemonic(descriptor.mnemonic, descriptor.passphrase)
      : fromNsec(descriptor.nsec)

  try {
    return {
      rootType: descriptor.type,
      recoverable: descriptor.type === 'mnemonic-backed',
      masterNpub: root.masterPubkey,
    }
  } finally {
    root.destroy()
  }
}

export async function saveProfile(libraries, name, descriptor, options = {}) {
  validateProfileName(name)
  await ensureDirs(options)
  const file = getProfileFile(name, options)
  if (!options.overwrite && (await pathExists(file))) {
    throw new Error(`Profile "${name}" already exists`)
  }

  const metadata = await describeRoot(libraries, descriptor)
  const profile = {
    name,
    savedAt: new Date().toISOString(),
    ...metadata,
    root: descriptor,
  }
  await writeFile(file, `${JSON.stringify(profile, null, 2)}\n`, { mode: 0o600 })
  return profile
}

export async function loadProfile(name, options = {}) {
  validateProfileName(name)
  const raw = await readFile(getProfileFile(name, options), 'utf8')
  const parsed = JSON.parse(raw)
  return {
    ...parsed,
    root: coerceRootDescriptor(parsed.root),
  }
}

export async function listProfiles(options = {}) {
  const active = await getActiveProfileName(options)
  let entries = []
  try {
    entries = await readdir(getProfilesDir(options))
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return []
    }
    throw error
  }

  const profiles = []
  for (const entry of entries.filter((item) => item.endsWith('.json')).sort()) {
    const profile = await loadProfile(entry.replace(/\.json$/, ''), options)
    profiles.push({
      name: profile.name,
      savedAt: profile.savedAt,
      rootType: profile.rootType,
      recoverable: profile.recoverable,
      masterNpub: profile.masterNpub,
      active: profile.name === active,
    })
  }
  return profiles
}

export async function setActiveProfile(name, options = {}) {
  await loadProfile(name, options)
  await ensureDirs(options)
  await writeFile(getActiveFile(options), `${name}\n`, { mode: 0o600 })
}

export async function getActiveProfileName(options = {}) {
  try {
    const raw = await readFile(getActiveFile(options), 'utf8')
    const name = raw.trim()
    return name.length > 0 ? name : undefined
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return undefined
    }
    throw error
  }
}

export async function removeProfile(name, options = {}) {
  validateProfileName(name)
  await rm(getProfileFile(name, options), { force: true })
  const active = await getActiveProfileName(options)
  if (active === name) {
    await rm(getActiveFile(options), { force: true })
  }
}
