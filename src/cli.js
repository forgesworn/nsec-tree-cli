import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { loadDependencies } from './deps.js'
import { createFormatter } from './format.js'
import { explainTopic as getExplainContent, TOPIC_NAMES } from './explain.js'
import {
  coerceRootDescriptor,
  describeRoot,
  getActiveProfileName,
  getProfileFile,
  listProfiles,
  loadProfile,
  removeProfile,
  saveProfile,
  setActiveProfile,
} from './profile-store.js'

class CliUsageError extends Error {
  constructor(message) {
    super(message)
    this.name = 'CliUsageError'
  }
}

const BOOLEAN_OPTIONS = new Set(['json', 'quiet', 'stdin', 'help', 'force', 'use', 'no-hints'])
const VALUE_OPTIONS = new Set([
  'mnemonic',
  'nsec',
  'root-file',
  'passphrase',
  'out',
  'out-dir',
  'name',
  'profile',
  'shares',
  'threshold',
])
const PATH_SEGMENT_RE = /^(?<name>[a-z0-9][a-z0-9:-]{0,31})(?:@(?<index>\d+))?$/

const HELP_TEXT = `nsec-tree CLI

Offline-first developer tooling for hierarchical Nostr identity.

Usage:
  nsec-tree root create [--passphrase <text>] [--name <profile>] [--json] [--quiet] [--out <file>]
  nsec-tree root restore (--mnemonic <phrase> | --root-file <file> | --stdin) [--passphrase <text>] [--name <profile>] [--json] [--quiet] [--out <file>]
  nsec-tree root import-nsec (--nsec <nsec> | --root-file <file> | --stdin) [--name <profile>] [--json] [--quiet] [--out <file>]
  nsec-tree root inspect [(--mnemonic <phrase> | --nsec <nsec> | --root-file <file> | --stdin | --profile <name>)] [--json]

  nsec-tree derive path <path> [(--mnemonic <phrase> | --nsec <nsec> | --root-file <file> | --stdin | --profile <name>)] [--passphrase <text>] [--json]
  nsec-tree derive persona <name> [(--mnemonic <phrase> | --nsec <nsec> | --root-file <file> | --stdin | --profile <name>)] [--passphrase <text>] [--json]
  nsec-tree derive account <path> [(--mnemonic <phrase> | --nsec <nsec> | --root-file <file> | --stdin | --profile <name>)] [--passphrase <text>] [--json]

  nsec-tree export npub <path> [(--mnemonic <phrase> | --nsec <nsec> | --root-file <file> | --stdin | --profile <name>)] [--passphrase <text>] [--json] [--quiet]
  nsec-tree export nsec <path> [(--mnemonic <phrase> | --nsec <nsec> | --root-file <file> | --stdin | --profile <name>)] [--passphrase <text>] [--json] [--quiet] [--out <file>]
  nsec-tree export identity <path> [(--mnemonic <phrase> | --nsec <nsec> | --root-file <file> | --stdin | --profile <name>)] [--passphrase <text>] [--json] [--out <file>]

  nsec-tree prove private <path> [(--mnemonic <phrase> | --nsec <nsec> | --root-file <file> | --stdin | --profile <name>)] [--passphrase <text>] [--json] [--out <file>]
  nsec-tree prove full <path> [(--mnemonic <phrase> | --nsec <nsec> | --root-file <file> | --stdin | --profile <name>)] [--passphrase <text>] [--json] [--out <file>]
  nsec-tree verify proof [<file> | --stdin] [--json] [--quiet]

  nsec-tree shamir split [(--mnemonic <phrase> | --root-file <file> | --stdin | --profile <name>)] --shares <n> --threshold <t> [--json] [--out-dir <dir>]
  nsec-tree shamir recover [<share-file> ... | --stdin] [--json] [--out <file>]

  nsec-tree profile save <name> (--mnemonic <phrase> | --nsec <nsec> | --root-file <file> | --stdin) [--passphrase <text>] [--force] [--use] [--json]
  nsec-tree profile list [--json]
  nsec-tree profile use <name> [--json]
  nsec-tree profile show [name] [--json]
  nsec-tree profile remove <name> [--json]

  nsec-tree inspect path <path> [--json]
  nsec-tree inspect root [(--mnemonic <phrase> | --nsec <nsec> | --root-file <file> | --stdin | --profile <name>)] [--json]
  nsec-tree explain model|proofs|recovery|paths|offline

Options:
  --json          Machine-readable JSON output
  --quiet         Bare values only, no formatting
  --no-hints      Suppress "Try next" suggestions
  --help          Show this help text

Environment:
  NSEC_TREE_NO_HINTS=1    Permanently disable hints
  NO_COLOR=1              Disable colour output

Examples:
  nsec-tree root create --name main
  nsec-tree derive path personal/forum-burner
  nsec-tree export nsec personal/forum-burner
  nsec-tree prove private personal/forum-burner
`

function detectCommandPrefix() {
  const scriptPath = process.argv[1] ?? ''
  if (scriptPath.includes('_npx') || scriptPath.includes('.npm/_npx')) {
    return 'npx nsec-tree'
  }
  return 'nsec-tree'
}

export const nodeIo = {
  async stdout(text) {
    process.stdout.write(text)
  },
  async stderr(text) {
    process.stderr.write(text)
  },
  async readStdin() {
    const chunks = []
    for await (const chunk of process.stdin) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
    }
    return Buffer.concat(chunks).toString('utf8')
  },
  isStdoutTty: Boolean(process.stdout.isTTY),
  commandPrefix: detectCommandPrefix(),
}

function parseArgs(argv) {
  const positionals = []
  const options = new Map()

  for (let index = 0; index < argv.length; index++) {
    const token = argv[index]
    if (!token.startsWith('--')) {
      positionals.push(token)
      continue
    }

    const raw = token.slice(2)
    if (!raw) {
      throw new CliUsageError('Invalid option "--"')
    }

    const eqIndex = raw.indexOf('=')
    const name = eqIndex === -1 ? raw : raw.slice(0, eqIndex)
    const inlineValue = eqIndex === -1 ? undefined : raw.slice(eqIndex + 1)

    if (BOOLEAN_OPTIONS.has(name)) {
      if (inlineValue !== undefined) {
        throw new CliUsageError(`Option "--${name}" does not accept a value`)
      }
      options.set(name, true)
      continue
    }

    if (!VALUE_OPTIONS.has(name)) {
      throw new CliUsageError(`Unknown option "--${name}"`)
    }

    const value = inlineValue ?? argv[index + 1]
    if (value === undefined || value.startsWith('--')) {
      throw new CliUsageError(`Option "--${name}" requires a value`)
    }
    options.set(name, value)
    if (inlineValue === undefined) {
      index++
    }
  }

  return { positionals, options }
}

function hasFlag(parsed, name) {
  return parsed.options.get(name) === true
}

function getOption(parsed, name) {
  const value = parsed.options.get(name)
  return typeof value === 'string' ? value : undefined
}

function getEnv(name) {
  const value = process.env[name]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function ensureNoExtraPositionals(parsed, expected) {
  if (parsed.positionals.length !== expected) {
    throw new CliUsageError('Unexpected positional arguments')
  }
}

function toNumberOption(parsed, name) {
  const value = getOption(parsed, name)
  if (value === undefined) {
    return undefined
  }
  const number = Number.parseInt(value, 10)
  if (!Number.isInteger(number)) {
    throw new CliUsageError(`Option "--${name}" must be an integer`)
  }
  return number
}

function normalizePathSegments(segments) {
  return segments.map((segment) => `${segment.name}@${segment.requestedIndex}`).join('/')
}

function parsePath(rawPath) {
  if (!rawPath || rawPath.startsWith('/') || rawPath.endsWith('/')) {
    throw new CliUsageError('Path must be non-empty and must not start or end with "/"')
  }

  return rawPath.split('/').map((rawSegment) => {
    const match = PATH_SEGMENT_RE.exec(rawSegment)
    if (!match || !match.groups || !match.groups.name) {
      throw new CliUsageError(
        `Path segment "${rawSegment}" is invalid: names must be lowercase, shell-friendly, and up to 32 chars`,
      )
    }
    return {
      name: match.groups.name,
      requestedIndex: match.groups.index ? Number.parseInt(match.groups.index, 10) : 0,
    }
  })
}

async function printText(io, text) {
  await io.stdout(text.endsWith('\n') ? text : `${text}\n`)
}

async function printJson(io, value) {
  await io.stdout(`${JSON.stringify(value, null, 2)}\n`)
}

async function writeSecretFile(path, content) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  await writeFile(path, content, { mode: 0o600 })
}

function readDescriptorFromText(text) {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new CliUsageError('Input text is empty')
  }

  try {
    return coerceRootDescriptor(JSON.parse(trimmed))
  } catch {
    if (trimmed.startsWith('nsec1')) {
      return { type: 'nsec-backed', nsec: trimmed }
    }
    return { type: 'mnemonic-backed', mnemonic: trimmed }
  }
}

async function resolveRootSource(parsed, io, libraries, options = {}) {
  const mnemonic = getOption(parsed, 'mnemonic') ?? getEnv('NSEC_TREE_MNEMONIC')
  const nsec = getOption(parsed, 'nsec') ?? getEnv('NSEC_TREE_NSEC')
  const rootFile = getOption(parsed, 'root-file')
  const useStdin = hasFlag(parsed, 'stdin')
  const explicitProfile = getOption(parsed, 'profile') ?? getEnv('NSEC_TREE_PROFILE')
  const passphrase = getOption(parsed, 'passphrase')

  const labels = [
    mnemonic ? 'mnemonic' : null,
    nsec ? 'nsec' : null,
    rootFile ? 'root-file' : null,
    useStdin ? 'stdin' : null,
    explicitProfile ? 'profile' : null,
  ].filter(Boolean)

  if (labels.length > 1) {
    throw new CliUsageError(`Expected exactly one root input source, got ${labels.length}`)
  }

  if (mnemonic) {
    return {
      descriptor: { type: 'mnemonic-backed', mnemonic, passphrase },
      source: 'explicit mnemonic',
    }
  }
  if (nsec) {
    return {
      descriptor: { type: 'nsec-backed', nsec },
      source: 'explicit nsec',
    }
  }
  if (rootFile || useStdin) {
    const text = rootFile ? await readFile(rootFile, 'utf8') : await io.readStdin()
    return {
      descriptor: readDescriptorFromText(text),
      source: rootFile ? `file ${rootFile}` : 'stdin',
    }
  }
  if (explicitProfile) {
    const profile = await loadProfile(explicitProfile, { baseDir: options.profileBaseDir })
    return {
      descriptor: profile.root,
      profileName: profile.name,
      source: `profile ${profile.name}`,
    }
  }

  if (options.allowImplicitProfile !== false) {
    const active = await getActiveProfileName({ baseDir: options.profileBaseDir })
    if (active) {
      const profile = await loadProfile(active, { baseDir: options.profileBaseDir })
      return {
        descriptor: profile.root,
        profileName: profile.name,
        source: `active profile ${profile.name}`,
      }
    }
  }

  throw new CliUsageError('No root input provided. Use --mnemonic, --nsec, --root-file, --stdin, or --profile.')
}

function openRoot(libraries, descriptor) {
  const root =
    descriptor.type === 'mnemonic-backed'
      ? libraries.nsecTree.fromMnemonic(descriptor.mnemonic, descriptor.passphrase)
      : libraries.nsecTree.fromNsec(descriptor.nsec)

  return {
    root,
    rootType: descriptor.type,
    recoverable: descriptor.type === 'mnemonic-backed',
  }
}

function derivePath(libraries, root, rawPath) {
  const pathSegments = parsePath(rawPath)
  const identities = []
  const derivedSegments = []
  let currentIdentity = null

  for (const segment of pathSegments) {
    const identity = currentIdentity
      ? libraries.nsecTree.deriveFromIdentity(currentIdentity, segment.name, segment.requestedIndex)
      : libraries.nsecTree.derive(root, segment.name, segment.requestedIndex)
    identities.push(identity)
    currentIdentity = identity
    derivedSegments.push({
      ...segment,
      actualIndex: identity.index,
      npub: identity.npub,
    })
  }

  if (!currentIdentity) {
    throw new CliUsageError('Path must contain at least one segment')
  }

  return {
    identity: currentIdentity,
    normalizedPath: normalizePathSegments(pathSegments),
    segments: derivedSegments,
    identities,
  }
}

function identityPayload(result) {
  return {
    path: result.normalizedPath,
    segments: result.segments,
    npub: result.identity.npub,
    nsec: result.identity.nsec,
    publicKey: Buffer.from(result.identity.publicKey).toString('hex'),
    purpose: result.identity.purpose,
    index: result.identity.index,
  }
}

async function maybeSaveProfileAfterRootCommand(libraries, parsed, descriptor, options) {
  const name = getOption(parsed, 'name')
  if (!name) {
    return undefined
  }
  const profile = await saveProfile(libraries, name, descriptor, {
    baseDir: options.profileBaseDir,
    overwrite: hasFlag(parsed, 'force'),
  })
  await setActiveProfile(name, { baseDir: options.profileBaseDir })
  return profile
}

async function handleRoot(parsed, io, libraries, options, fmt) {
  const subcommand = parsed.positionals[1]

  if (subcommand === 'create') {
    ensureNoExtraPositionals(parsed, 2)
    const mnemonic = libraries.bip39.generateMnemonic(libraries.bip39English.wordlist, 128)
    const descriptor = {
      type: 'mnemonic-backed',
      mnemonic,
      passphrase: getOption(parsed, 'passphrase'),
    }
    const summary = await describeRoot(libraries, descriptor)
    const savedProfile = await maybeSaveProfileAfterRootCommand(libraries, parsed, descriptor, options)
    const outFile = getOption(parsed, 'out')
    if (outFile) {
      await writeSecretFile(outFile, `${JSON.stringify(descriptor, null, 2)}\n`)
    }
    const payload = {
      ...summary,
      mnemonic,
      profile: savedProfile?.name,
    }
    if (hasFlag(parsed, 'json')) {
      await printJson(io, payload)
      return 0
    }
    if (hasFlag(parsed, 'quiet')) {
      await printText(io, mnemonic)
      return 0
    }
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
    ]
    if (savedProfile) {
      lines.splice(5, 0, fmt.labelValue('profile', savedProfile.name))
      lines.push(
        '',
        fmt.nextSteps([
          options.cmd('derive path personal'),
          options.cmd('export nsec personal'),
        ]),
      )
    } else if (options.showHints) {
      lines.push(
        '',
        `  ${fmt.c.dim}Tip: re-run with --name to save as a profile:${fmt.c.reset}`,
        `    ${fmt.c.cyan}${options.cmd('root create --name main')}${fmt.c.reset}`,
        '',
        `  ${fmt.c.dim}Or pipe the mnemonic (avoids shell history):${fmt.c.reset}`,
        `    ${fmt.c.cyan}echo "<mnemonic>" | ${options.cmd('profile save main --stdin --use')}${fmt.c.reset}`,
      )
    }
    await printText(io, fmt.section(lines))
    return 0
  }

  if (subcommand === 'restore' || subcommand === 'import-nsec') {
    ensureNoExtraPositionals(parsed, 2)
    const rootSource = await resolveRootSource(parsed, io, libraries, {
      profileBaseDir: options.profileBaseDir,
      allowImplicitProfile: false,
    })
    if (subcommand === 'restore' && rootSource.descriptor.type !== 'mnemonic-backed') {
      throw new CliUsageError('root restore expects mnemonic-backed input')
    }
    if (subcommand === 'import-nsec' && rootSource.descriptor.type !== 'nsec-backed') {
      throw new CliUsageError('root import-nsec expects nsec-backed input')
    }
    const summary = await describeRoot(libraries, rootSource.descriptor)
    const savedProfile = await maybeSaveProfileAfterRootCommand(libraries, parsed, rootSource.descriptor, options)
    const outFile = getOption(parsed, 'out')
    if (outFile) {
      await writeSecretFile(outFile, `${JSON.stringify(rootSource.descriptor, null, 2)}\n`)
    }
    const payload = {
      ...summary,
      profile: savedProfile?.name,
    }
    if (hasFlag(parsed, 'json')) {
      await printJson(io, payload)
      return 0
    }
    if (hasFlag(parsed, 'quiet')) {
      await printText(io, summary.masterNpub)
      return 0
    }
    const title = subcommand === 'restore' ? 'Root restored' : 'Root imported'
    const lines = [
      fmt.boxHeader(title),
      '',
      fmt.labelValue('root type', summary.rootType),
      fmt.labelValue('recoverable', summary.recoverable ? 'yes' : 'no'),
      fmt.labelValue('master npub', summary.masterNpub),
    ]
    if (savedProfile) lines.push(fmt.labelValue('profile', savedProfile.name))
    if (rootSource.source) lines.push(fmt.labelValue('source', rootSource.source))
    if (savedProfile) {
      lines.push('', fmt.nextSteps([options.cmd('derive path personal')]))
    } else {
      lines.push('', fmt.nextSteps([options.cmd(`${subcommand === 'restore' ? 'root restore' : 'root import-nsec'} ... --name main`)]))
    }
    await printText(io, fmt.section(lines))
    return 0
  }

  if (subcommand === 'inspect') {
    ensureNoExtraPositionals(parsed, 2)
    const rootSource = await resolveRootSource(parsed, io, libraries, {
      profileBaseDir: options.profileBaseDir,
      allowImplicitProfile: true,
    })
    const summary = await describeRoot(libraries, rootSource.descriptor)
    const payload = {
      ...summary,
      source: rootSource.source,
      profile: rootSource.profileName,
    }
    if (hasFlag(parsed, 'json')) {
      await printJson(io, payload)
      return 0
    }
    const lines = [
      fmt.labelValue('root type', summary.rootType),
      fmt.labelValue('recoverable', summary.recoverable ? 'yes' : 'no'),
      fmt.labelValue('master npub', summary.masterNpub),
    ]
    if (rootSource.profileName) lines.push(fmt.labelValue('profile', rootSource.profileName))
    if (rootSource.source) lines.push(fmt.labelValue('source', rootSource.source))
    const caps = ['derive', 'export', 'prove']
    if (summary.recoverable) caps.push('phrase-backup', 'shamir')
    lines.push(fmt.labelValue('capabilities', caps.join(', ')))
    const inspectHints = [options.cmd('derive path personal')]
    if (summary.recoverable) inspectHints.push(options.cmd('shamir split --shares 3 --threshold 2'))
    inspectHints.push(options.cmd('explain model'))
    lines.push('', fmt.nextSteps(inspectHints))
    await printText(io, fmt.section(lines))
    return 0
  }

  throw new CliUsageError(`Unknown root subcommand "${subcommand ?? ''}"`)
}

async function withDerivedPath(parsed, io, libraries, options, fmt, handler) {
  const rootSource = await resolveRootSource(parsed, io, libraries, {
    profileBaseDir: options.profileBaseDir,
    allowImplicitProfile: true,
  })
  const pathArg = parsed.positionals[2]
  if (!pathArg) {
    throw new CliUsageError('Path argument is required')
  }
  const opened = openRoot(libraries, rootSource.descriptor)
  let result
  try {
    result = derivePath(libraries, opened.root, pathArg)
    return await handler(result, { ...opened, ...rootSource }, fmt)
  } finally {
    if (result) {
      for (const identity of result.identities) {
        libraries.nsecTree.zeroise(identity)
      }
    }
    opened.root.destroy()
  }
}

async function handleDerive(parsed, io, libraries, options, fmt) {
  const subcommand = parsed.positionals[1]
  if (!['path', 'persona', 'account'].includes(subcommand)) {
    throw new CliUsageError('Supported derive subcommands are: path, persona, account')
  }

  if ((subcommand === 'persona' || subcommand === 'account') && parsed.positionals[2]) {
    parsed = {
      ...parsed,
      positionals: ['derive', 'path', parsed.positionals[2]],
    }
  }

  return withDerivedPath(parsed, io, libraries, options, fmt, async (result, rootInfo, fmt) => {
    const payload = {
      rootType: rootInfo.rootType,
      recoverable: rootInfo.recoverable,
      path: result.normalizedPath,
      segments: result.segments,
      npub: result.identity.npub,
      publicKey: Buffer.from(result.identity.publicKey).toString('hex'),
      purpose: result.identity.purpose,
      index: result.identity.index,
      secretRequested: false,
      profile: rootInfo.profileName,
    }
    if (hasFlag(parsed, 'json')) {
      await printJson(io, payload)
      return 0
    }
    const lines = [
      fmt.labelValue('root type', rootInfo.rootType),
      fmt.labelValue('path', result.normalizedPath),
      '',
      fmt.renderTree(result.segments),
      '',
    ]
    const pathArg = parsed.positionals[2]
    lines.push('', fmt.nextSteps([
      options.cmd(`export nsec ${pathArg}`),
      options.cmd(`prove private ${pathArg}`),
    ]))
    await printText(io, fmt.section(lines))
    return 0
  })
}

async function handleExport(parsed, io, libraries, options, fmt) {
  const subcommand = parsed.positionals[1]
  if (!['npub', 'nsec', 'identity'].includes(subcommand)) {
    throw new CliUsageError('Supported export subcommands are: npub, nsec, identity')
  }

  return withDerivedPath(parsed, io, libraries, options, fmt, async (result, _rootInfo, fmt) => {
    const outFile = getOption(parsed, 'out')
    if (subcommand === 'npub') {
      const payload = { path: result.normalizedPath, npub: result.identity.npub }
      if (hasFlag(parsed, 'json')) {
        await printJson(io, payload)
      } else if (hasFlag(parsed, 'quiet')) {
        await printText(io, result.identity.npub)
      } else {
        const lines = [
          fmt.labelValue('path', result.normalizedPath),
          fmt.labelValue('npub', result.identity.npub),
          '',
          fmt.nextSteps([
            options.cmd(`export nsec ${parsed.positionals[2]}`),
            options.cmd(`prove private ${parsed.positionals[2]}`),
          ]),
        ]
        await printText(io, fmt.section(lines))
      }
      return 0
    }

    if (subcommand === 'nsec') {
      if (outFile) {
        await writeSecretFile(
          outFile,
          hasFlag(parsed, 'json')
            ? `${JSON.stringify({ path: result.normalizedPath, nsec: result.identity.nsec }, null, 2)}\n`
            : `${result.identity.nsec}\n`,
        )
      }
      if (hasFlag(parsed, 'json')) {
        await printJson(io, { path: result.normalizedPath, nsec: result.identity.nsec })
      } else if (hasFlag(parsed, 'quiet')) {
        await printText(io, result.identity.nsec)
      } else {
        const lines = [
          fmt.labelValue('path', result.normalizedPath),
          fmt.labelValue('nsec', result.identity.nsec),
          '',
          fmt.warning('This is a private key. Store it securely.'),
          '',
          fmt.nextSteps([
            options.cmd(`prove private ${parsed.positionals[2]}`),
          ]),
        ]
        await printText(io, fmt.section(lines))
      }
      return 0
    }

    const payload = identityPayload(result)
    if (outFile) {
      await writeSecretFile(outFile, `${JSON.stringify(payload, null, 2)}\n`)
    }
    if (hasFlag(parsed, 'json')) {
      await printJson(io, payload)
    } else {
      const lines = [
        fmt.labelValue('path', result.normalizedPath),
        fmt.labelValue('purpose', result.identity.purpose),
        fmt.labelValue('index', String(result.identity.index)),
        fmt.labelValue('npub', result.identity.npub),
        fmt.labelValue('nsec', result.identity.nsec),
        fmt.labelValue('public key', Buffer.from(result.identity.publicKey).toString('hex')),
        '',
        `  ${fmt.c.dim}This child is a standalone Nostr identity.${fmt.c.reset}`,
        '',
        fmt.nextSteps([
          options.cmd(`prove private ${parsed.positionals[2]}`),
        ]),
      ]
      await printText(io, fmt.section(lines))
    }
    return 0
  })
}

async function handleProve(parsed, io, libraries, options, fmt) {
  const subcommand = parsed.positionals[1]
  if (!['private', 'full'].includes(subcommand)) {
    throw new CliUsageError('Supported prove subcommands are: private, full')
  }

  return withDerivedPath(parsed, io, libraries, options, fmt, async (result, rootInfo, fmt) => {
    const proof =
      subcommand === 'private'
        ? libraries.nsecTree.createBlindProof(rootInfo.root, result.identity)
        : libraries.nsecTree.createFullProof(rootInfo.root, result.identity)

    const outFile = getOption(parsed, 'out')
    if (outFile) {
      await writeSecretFile(outFile, `${JSON.stringify(proof, null, 2)}\n`)
    }
    if (hasFlag(parsed, 'json')) {
      await printJson(io, proof)
    } else {
      const proofType = subcommand === 'private' ? 'private' : 'full'
      const lines = [
        fmt.labelValue('proof type', proofType),
        fmt.labelValue('master pubkey', proof.masterPubkey),
        fmt.labelValue('child pubkey', proof.childPubkey),
      ]
      if (proof.purpose !== undefined) lines.push(fmt.labelValue('purpose', proof.purpose))
      if (proof.index !== undefined) lines.push(fmt.labelValue('index', String(proof.index)))
      lines.push(fmt.labelValue('attestation', proof.attestation), fmt.labelValue('signature', proof.signature))
      const explanation = proofType === 'private'
        ? 'This proof shows shared root ownership\n  without revealing how the child was derived.'
        : 'This proof reveals the full derivation path.\n  Anyone can verify the exact relationship.'
      lines.push('', `  ${fmt.c.dim}${explanation}${fmt.c.reset}`)
      lines.push('', fmt.nextSteps([
        options.cmd(`prove ${subcommand} ${parsed.positionals[2]} --json | ${options.cmd('verify proof --stdin')}`),
      ]))
      await printText(io, fmt.section(lines))
    }
    return 0
  })
}

function coerceProof(raw) {
  if (typeof raw !== 'object' || raw === null) {
    throw new CliUsageError('Proof JSON must be an object')
  }
  if (raw.proof && typeof raw.proof === 'object') {
    return coerceProof(raw.proof)
  }
  if (
    typeof raw.masterPubkey !== 'string' ||
    typeof raw.childPubkey !== 'string' ||
    typeof raw.attestation !== 'string' ||
    typeof raw.signature !== 'string'
  ) {
    throw new CliUsageError('Proof JSON is missing required fields')
  }
  return raw
}

async function handleVerify(parsed, io, libraries, options, fmt) {
  if (parsed.positionals[1] !== 'proof') {
    throw new CliUsageError('Only "verify proof" is supported')
  }
  const proofFile = parsed.positionals[2]
  const useStdin = hasFlag(parsed, 'stdin') || proofFile === '-'
  if (!useStdin && !proofFile) {
    throw new CliUsageError('Provide a proof file path or use --stdin')
  }
  if (useStdin && proofFile && proofFile !== '-') {
    throw new CliUsageError('Use either a proof file path or --stdin')
  }

  const rawText = useStdin ? await io.readStdin() : await readFile(proofFile, 'utf8')
  let parsed_proof
  try {
    parsed_proof = JSON.parse(rawText)
  } catch {
    throw new CliUsageError('Invalid proof JSON')
  }
  const proof = coerceProof(parsed_proof)
  const valid = libraries.nsecTree.verifyProof(proof)
  const proofType = proof.purpose === undefined ? 'private' : 'full'

  if (hasFlag(parsed, 'json')) {
    await printJson(io, { valid, proofType, proof })
  } else if (hasFlag(parsed, 'quiet')) {
    await printText(io, valid ? 'valid' : 'invalid')
  } else {
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
      lines.push('', fmt.nextSteps([
        options.cmd('explain proofs'),
      ]))
      await printText(io, fmt.section(lines))
    } else {
      await printText(io, fmt.failure('Proof is invalid'))
    }
  }
  return valid ? 0 : 1
}

function shareWordsFromText(text) {
  return text
    .trim()
    .split(/\s+/)
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean)
}

async function handleShamir(parsed, io, libraries, options, fmt) {
  const subcommand = parsed.positionals[1]

  if (subcommand === 'split') {
    ensureNoExtraPositionals(parsed, 2)
    const shares = toNumberOption(parsed, 'shares')
    const threshold = toNumberOption(parsed, 'threshold')
    if (shares === undefined || threshold === undefined) {
      throw new CliUsageError('shamir split requires --shares and --threshold')
    }
    if (shares < 2 || shares > 255) {
      throw new CliUsageError('--shares must be between 2 and 255')
    }
    if (threshold < 2 || threshold > shares) {
      throw new CliUsageError(`--threshold must be between 2 and ${shares}`)
    }
    const rootSource = await resolveRootSource(parsed, io, libraries, {
      profileBaseDir: options.profileBaseDir,
      allowImplicitProfile: true,
    })
    if (rootSource.descriptor.type !== 'mnemonic-backed') {
      throw new CliUsageError(
        'This root is nsec-backed, so Shamir split is unavailable without a mnemonic-backed root',
      )
    }

    const entropy = libraries.bip39.mnemonicToEntropy(
      rootSource.descriptor.mnemonic,
      libraries.bip39English.wordlist,
    )
    try {
      const rawShares = libraries.shamirWords.splitSecret(entropy, threshold, shares)
      const payload = rawShares.map((share) => {
        const words = libraries.shamirWords.shareToWords(share)
        return {
          index: share.id,
          threshold: share.threshold,
          words,
          phrase: words.join(' '),
        }
      })

      const outDir = getOption(parsed, 'out-dir')
      if (outDir) {
        await mkdir(outDir, { recursive: true, mode: 0o700 })
        for (const share of payload) {
          await writeSecretFile(join(outDir, `share-${share.index}.txt`), `${share.phrase}\n`)
        }
      }
      if (hasFlag(parsed, 'json')) {
        await printJson(io, {
          rootType: 'mnemonic-backed',
          recoverable: true,
          shares: payload,
        })
      } else {
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
          '',
          fmt.nextSteps([
            options.cmd('shamir recover share-1.txt share-2.txt'),
            options.cmd('explain recovery'),
          ]),
        )
        await printText(io, fmt.section(lines))
      }
      return 0
    } finally {
      entropy.fill(0)
    }
  }

  if (subcommand === 'recover') {
    const files = parsed.positionals.slice(2)
    const useStdin = hasFlag(parsed, 'stdin')
    if (!useStdin && files.length === 0) {
      throw new CliUsageError('Provide share files or use --stdin')
    }

    const shareTexts = []
    if (useStdin) {
      const stdinText = await io.readStdin()
      for (const line of stdinText.split(/\r?\n/)) {
        if (line.trim()) {
          shareTexts.push(line.trim())
        }
      }
    }
    for (const file of files) {
      shareTexts.push((await readFile(file, 'utf8')).trim())
    }

    const sharesData = shareTexts.map((text) => libraries.shamirWords.wordsToShare(shareWordsFromText(text)))
    const threshold = sharesData[0]?.threshold
    if (!threshold) {
      throw new CliUsageError('No valid shares were provided')
    }
    const entropy = libraries.shamirWords.reconstructSecret(sharesData, threshold)
    try {
      const mnemonic = libraries.bip39.entropyToMnemonic(entropy, libraries.bip39English.wordlist)
      const outFile = getOption(parsed, 'out')
      if (outFile) {
        await writeSecretFile(outFile, `${mnemonic}\n`)
      }
      if (hasFlag(parsed, 'json')) {
        await printJson(io, {
          rootType: 'mnemonic-backed',
          recoverable: true,
          mnemonic,
        })
      } else {
        const lines = [
          fmt.boxHeader('Mnemonic recovered'),
          '',
          fmt.labelValue('root type', 'mnemonic-backed'),
          fmt.labelValue('recoverable', 'yes'),
          '',
          fmt.labelValue('mnemonic', fmt.wrapWords(mnemonic)),
          '',
          fmt.warning('Store this mnemonic offline. It cannot be recovered again without shares.'),
          ...(options.showHints ? [
            '',
            `  ${fmt.c.dim}Pipe the mnemonic to save as a profile (avoids shell history):${fmt.c.reset}`,
            `    ${fmt.c.cyan}echo "<mnemonic>" | ${options.cmd('profile save main --stdin --use')}${fmt.c.reset}`,
          ] : []),
        ]
        await printText(io, fmt.section(lines))
      }
      return 0
    } finally {
      entropy.fill(0)
    }
  }

  throw new CliUsageError(`Unknown shamir subcommand "${subcommand ?? ''}"`)
}

async function handleProfile(parsed, io, libraries, options, fmt) {
  const subcommand = parsed.positionals[1]

  if (subcommand === 'save') {
    const name = parsed.positionals[2]
    if (!name) {
      throw new CliUsageError('profile save requires a profile name')
    }
    ensureNoExtraPositionals(parsed, 3)
    const rootSource = await resolveRootSource(parsed, io, libraries, {
      profileBaseDir: options.profileBaseDir,
      allowImplicitProfile: false,
    })
    const profile = await saveProfile(libraries, name, rootSource.descriptor, {
      baseDir: options.profileBaseDir,
      overwrite: hasFlag(parsed, 'force'),
    })
    if (hasFlag(parsed, 'use')) {
      await setActiveProfile(name, { baseDir: options.profileBaseDir })
    }
    if (hasFlag(parsed, 'json')) {
      await printJson(io, profile)
    } else {
      const profilePath = getProfileFile(name, { baseDir: options.profileBaseDir })
      const lines = [
        fmt.labelValue('saved profile', profile.name),
        fmt.labelValue('master npub', profile.masterNpub),
        fmt.labelValue('stored at', profilePath),
        '',
        fmt.nextSteps([
          options.cmd('derive path personal'),
          options.cmd('export npub personal'),
        ]),
      ]
      await printText(io, fmt.section(lines))
    }
    return 0
  }

  if (subcommand === 'list') {
    ensureNoExtraPositionals(parsed, 2)
    const profiles = await listProfiles({ baseDir: options.profileBaseDir })
    if (hasFlag(parsed, 'json')) {
      await printJson(io, profiles)
    } else if (profiles.length === 0) {
      const lines = [
        `  ${fmt.c.dim}No profiles saved yet.${fmt.c.reset}`,
        '',
        fmt.nextSteps([
          options.cmd('root create --name main'),
        ]),
      ]
      await printText(io, fmt.section(lines))
    } else {
      const tableLines = profiles.map(p => {
        const prefix = p.active ? `${fmt.c.green}*${fmt.c.reset} ` : '  '
        const recovery = p.recoverable ? 'recoverable' : 'no recovery'
        return `  ${prefix}${fmt.c.bold}${p.name.padEnd(12)}${fmt.c.reset} ${p.rootType.padEnd(18)} ${fmt.c.dim}${recovery.padEnd(14)}${fmt.c.reset} ${fmt.c.cyan}${p.masterNpub}${fmt.c.reset}`
      })
      const hasActive = profiles.some(p => p.active)
      const hints = hasActive
        ? [options.cmd('derive path personal')]
        : [options.cmd(`profile use ${profiles[0].name}`)]
      tableLines.push('', fmt.nextSteps(hints))
      await printText(io, tableLines.join('\n'))
    }
    return 0
  }

  if (subcommand === 'use') {
    const name = parsed.positionals[2]
    if (!name) {
      throw new CliUsageError('profile use requires a profile name')
    }
    ensureNoExtraPositionals(parsed, 3)
    await setActiveProfile(name, { baseDir: options.profileBaseDir })
    if (hasFlag(parsed, 'json')) {
      await printJson(io, { activeProfile: name })
    } else {
      const lines = [
        fmt.labelValue('active profile', name),
        '',
        fmt.nextSteps([
          options.cmd('derive path personal'),
          options.cmd('root inspect'),
        ]),
      ]
      await printText(io, fmt.section(lines))
    }
    return 0
  }

  if (subcommand === 'show') {
    if (parsed.positionals.length > 3) {
      throw new CliUsageError('Unexpected positional arguments')
    }
    const name = parsed.positionals[2] ?? (await getActiveProfileName({ baseDir: options.profileBaseDir }))
    if (!name) {
      throw new CliUsageError('No profile name provided and no active profile is set')
    }
    const profile = await loadProfile(name, { baseDir: options.profileBaseDir })
    if (hasFlag(parsed, 'json')) {
      const { root: _root, ...safeProfile } = profile
      await printJson(io, safeProfile)
    } else {
      const lines = [
        fmt.labelValue('profile', profile.name),
        fmt.labelValue('root type', profile.rootType),
        fmt.labelValue('recoverable', profile.recoverable ? 'yes' : 'no'),
        fmt.labelValue('master npub', profile.masterNpub),
        fmt.labelValue('saved at', profile.savedAt),
        '',
        fmt.nextSteps([
          options.cmd('derive path personal'),
          options.cmd('profile list'),
        ]),
      ]
      await printText(io, fmt.section(lines))
    }
    return 0
  }

  if (subcommand === 'remove') {
    const name = parsed.positionals[2]
    if (!name) {
      throw new CliUsageError('profile remove requires a profile name')
    }
    ensureNoExtraPositionals(parsed, 3)
    await removeProfile(name, { baseDir: options.profileBaseDir })
    if (hasFlag(parsed, 'json')) {
      await printJson(io, { removed: name })
    } else {
      await printText(io, fmt.labelValue('removed profile', name))
    }
    return 0
  }

  throw new CliUsageError(`Unknown profile subcommand "${subcommand ?? ''}"`)
}

async function handleInspect(parsed, io, libraries, options, fmt) {
  const subcommand = parsed.positionals[1]
  if (subcommand === 'path') {
    const rawPath = parsed.positionals[2]
    if (!rawPath) {
      throw new CliUsageError('inspect path requires a path argument')
    }
    const segments = parsePath(rawPath)
    const payload = {
      path: normalizePathSegments(segments),
      segments,
      deterministic: true,
    }
    if (hasFlag(parsed, 'json')) {
      await printJson(io, payload)
    } else {
      const lines = [
        fmt.labelValue('path', payload.path),
        fmt.labelValue('deterministic', 'yes'),
        '',
        `  ${fmt.c.dim}segments:${fmt.c.reset}`,
        ...segments.map((seg, i) => `    ${fmt.c.dim}${i + 1}.${fmt.c.reset} ${fmt.c.bold}${seg.name}${fmt.c.reset} ${fmt.c.dim}@ ${seg.requestedIndex}${fmt.c.reset}`),
        '',
        fmt.nextSteps([
          options.cmd(`derive path ${rawPath}`),
        ]),
      ]
      await printText(io, fmt.section(lines))
    }
    return 0
  }

  if (subcommand === 'root') {
    ensureNoExtraPositionals(parsed, 2)
    const rootSource = await resolveRootSource(parsed, io, libraries, {
      profileBaseDir: options.profileBaseDir,
      allowImplicitProfile: true,
    })
    const summary = await describeRoot(libraries, rootSource.descriptor)
    const payload = { ...summary, profile: rootSource.profileName, source: rootSource.source }
    if (hasFlag(parsed, 'json')) {
      await printJson(io, payload)
    } else {
      const lines = [
        fmt.labelValue('root type', summary.rootType),
        fmt.labelValue('recoverable', summary.recoverable ? 'yes' : 'no'),
        fmt.labelValue('master npub', summary.masterNpub),
      ]
      if (rootSource.profileName) lines.push(fmt.labelValue('profile', rootSource.profileName))
      if (rootSource.source) lines.push(fmt.labelValue('source', rootSource.source))
      const caps = ['derive', 'export', 'prove']
      if (summary.recoverable) caps.push('phrase-backup', 'shamir')
      lines.push(fmt.labelValue('capabilities', caps.join(', ')))
      await printText(io, fmt.section(lines))
    }
    return 0
  }

  throw new CliUsageError(`Unknown inspect subcommand "${subcommand ?? ''}"`)
}

async function handleExplain(parsed, io, fmt) {
  const topic = parsed.positionals[1]
  if (!topic) {
    throw new CliUsageError(`Explain topic is required. Topics: ${TOPIC_NAMES.join(', ')}`)
  }
  ensureNoExtraPositionals(parsed, 2)
  await printText(io, getExplainContent(topic, fmt))
  return 0
}

export async function runCli(argv, io = nodeIo, options = {}) {
  const libraries = await loadDependencies()

  const useColour = io.isStdoutTty && !process.env.NO_COLOR
  const fmt = createFormatter({ colour: useColour })
  const prefix = io.commandPrefix ?? 'nsec-tree'
  function cmd(args) { return `${prefix} ${args}` }

  try {
    const parsed = parseArgs(argv)
    const showHints = !hasFlag(parsed, 'no-hints') && !process.env.NSEC_TREE_NO_HINTS
    if (!showHints) {
      fmt.nextSteps = () => null
    }
    const opts = { ...options, cmd, showHints }
    if (hasFlag(parsed, 'help') || parsed.positionals.length === 0) {
      await printText(io, HELP_TEXT)
      return 0
    }

    const command = parsed.positionals[0]
    if (command === 'root') return await handleRoot(parsed, io, libraries, opts, fmt)
    if (command === 'derive') return await handleDerive(parsed, io, libraries, opts, fmt)
    if (command === 'export') return await handleExport(parsed, io, libraries, opts, fmt)
    if (command === 'prove') return await handleProve(parsed, io, libraries, opts, fmt)
    if (command === 'verify') return await handleVerify(parsed, io, libraries, opts, fmt)
    if (command === 'shamir') return await handleShamir(parsed, io, libraries, opts, fmt)
    if (command === 'profile') return await handleProfile(parsed, io, libraries, opts, fmt)
    if (command === 'inspect') return await handleInspect(parsed, io, libraries, opts, fmt)
    if (command === 'explain') return await handleExplain(parsed, io, fmt)

    throw new CliUsageError(`Unknown command "${command}"`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await io.stderr(`Error: ${message}\n`)
    return 1
  }
}
