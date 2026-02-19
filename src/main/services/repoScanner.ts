import * as os from 'os'
import * as fs from 'fs'
import { readdir, stat, access } from 'fs/promises'
import { basename, join } from 'path'
import type { GitRepoInfo } from '../../shared/ipc'
import { REPO_SCAN_CONCURRENCY } from '../../shared/constants'

const DEFAULT_MAX_DEPTH = 2
const SKIP_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  'coverage',
  'target'
])

interface ScanQueueItem {
  dir: string
  depth: number
}

function shouldSkipDirectoryName(name: string): boolean {
  if (name.startsWith('.')) return true
  return SKIP_DIR_NAMES.has(name)
}

async function checkForGitRepo(dirPath: string): Promise<boolean> {
  try {
    const gitPath = join(dirPath, '.git')
    const gitStat = await stat(gitPath)
    return gitStat.isDirectory()
  } catch {
    return false
  }
}

export async function scanGitRepos(baseDir: string): Promise<GitRepoInfo[]> {
  const repos: GitRepoInfo[] = []
  const seenPaths = new Set<string>()
  const expandedDir = baseDir.replace(/^~/, os.homedir())

  try {
    await access(expandedDir, fs.constants.R_OK)
  } catch {
    return repos
  }

  const queue: ScanQueueItem[] = [{ dir: expandedDir, depth: 1 }]

  while (queue.length > 0) {
    const batch = queue.splice(0, REPO_SCAN_CONCURRENCY)
    const batchResults = await Promise.all(
      batch.map(async ({ dir, depth }) => {
        if (depth > DEFAULT_MAX_DEPTH) return [] as ScanQueueItem[]

        try {
          const entries = await readdir(dir, { withFileTypes: true })
          const directories = entries
            .filter((entry) => entry.isDirectory() && !shouldSkipDirectoryName(entry.name))
            .sort((a, b) => a.name.localeCompare(b.name))

          const nextQueueItems: ScanQueueItem[] = []
          await Promise.all(directories.map(async (entry) => {
            const dirPath = join(dir, entry.name)
            if (await checkForGitRepo(dirPath)) {
              if (!seenPaths.has(dirPath)) {
                seenPaths.add(dirPath)
                repos.push({
                  path: dirPath,
                  name: basename(dirPath)
                })
              }
              return
            }

            if (depth < DEFAULT_MAX_DEPTH) {
              nextQueueItems.push({ dir: dirPath, depth: depth + 1 })
            }
          }))

          return nextQueueItems
        } catch {
          return [] as ScanQueueItem[]
        }
      })
    )

    for (const next of batchResults) {
      queue.push(...next)
    }
  }

  repos.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
  return repos
}
