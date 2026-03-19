import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const currentDir = dirname(fileURLToPath(import.meta.url))

let dependencyCache

async function importFirst(candidates) {
  let lastError
  for (const candidate of candidates) {
    try {
      return await import(candidate)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

function siblingPath(...segments) {
  return pathToFileURL(resolve(currentDir, '..', '..', ...segments)).href
}

export async function loadDependencies() {
  if (dependencyCache) {
    return dependencyCache
  }

  const nsecTree = await importFirst([
    'nsec-tree',
    siblingPath('nsec-tree', 'dist', 'index.js'),
  ])

  const shamirWords = await importFirst([
    '@forgesworn/shamir-words',
    siblingPath('shamir-words', 'dist', 'index.js'),
  ])

  const bip39 = await importFirst([
    '@scure/bip39',
    siblingPath('nsec-tree', 'node_modules', '@scure', 'bip39', 'index.js'),
    siblingPath('shamir-words', 'node_modules', '@scure', 'bip39', 'index.js'),
  ])

  const bip39English = await importFirst([
    '@scure/bip39/wordlists/english.js',
    siblingPath('nsec-tree', 'node_modules', '@scure', 'bip39', 'wordlists', 'english.js'),
    siblingPath('shamir-words', 'node_modules', '@scure', 'bip39', 'wordlists', 'english.js'),
  ])

  dependencyCache = {
    nsecTree,
    shamirWords,
    bip39,
    bip39English,
  }

  return dependencyCache
}
