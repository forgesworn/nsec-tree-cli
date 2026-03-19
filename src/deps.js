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
    if (process.env.NSEC_TREE_DEV && fallbacks.length > 0) {
      for (const fallback of fallbacks) {
        try {
          return await import(fallback)
        } catch {}
      }
    }
    throw new Error(`Could not resolve "${specifier}". Run npm install.`)
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
