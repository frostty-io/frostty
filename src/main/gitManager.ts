import { exec } from 'child_process'
import { promisify } from 'util'
import * as os from 'os'
import * as fs from 'fs'
import { readdir, stat, access } from 'fs/promises'
import { join, basename } from 'path'
import { ipcMain } from 'electron'
import {
  IPC_CHANNELS,
  GitStatus,
  GitBranch,
  GitOperationResult,
  GitStashEntry,
  GitFileStatus,
  GitRepoInfo
} from '../shared/ipc'
import { GIT_MAX_BUFFER } from '../shared/constants'

const execAsync = promisify(exec)

// ── Git helpers ──────────────────────────────────────────────────────────────

const GIT_COMMAND_TIMEOUT_MS = 10_000

async function runGitCommand(cwd: string, args: string): Promise<{ stdout: string; stderr: string }> {
  const expandedCwd = cwd.replace(/^~/, os.homedir())
  return execAsync(`git ${args}`, {
    cwd: expandedCwd,
    maxBuffer: GIT_MAX_BUFFER,
    timeout: GIT_COMMAND_TIMEOUT_MS
  })
}

function parseGitStatusCode(code: string): GitFileStatus['status'] {
  switch (code) {
    case 'M': return 'modified'
    case 'A': return 'added'
    case 'D': return 'deleted'
    case 'R': return 'renamed'
    case 'C': return 'copied'
    case '?': return 'untracked'
    case '!': return 'ignored'
    default: return 'modified'
  }
}

// ── Git status / branch queries ──────────────────────────────────────────────

async function getGitStatus(cwd: string): Promise<GitStatus> {
  const defaultStatus: GitStatus = {
    isRepo: false,
    branch: '',
    upstream: null,
    ahead: 0,
    behind: 0,
    staged: [],
    unstaged: [],
    untracked: [],
    conflicted: [],
    stashCount: 0
  }

  try {
    // Check if it's a git repo
    await runGitCommand(cwd, 'rev-parse --git-dir')

    // Get branch info
    const { stdout: branchOutput } = await runGitCommand(cwd, 'branch --show-current')
    const branch = branchOutput.trim() || 'HEAD'

    // Get upstream info
    let upstream: string | null = null
    let ahead = 0
    let behind = 0
    try {
      const { stdout: upstreamOutput } = await runGitCommand(cwd, `rev-parse --abbrev-ref ${branch}@{upstream}`)
      upstream = upstreamOutput.trim()

      // Get ahead/behind counts
      const { stdout: aheadBehind } = await runGitCommand(cwd, `rev-list --left-right --count ${branch}...${upstream}`)
      const [aheadStr, behindStr] = aheadBehind.trim().split(/\s+/)
      ahead = parseInt(aheadStr, 10) || 0
      behind = parseInt(behindStr, 10) || 0
    } catch {
      // No upstream configured
    }

    // Get porcelain status
    const { stdout: statusOutput } = await runGitCommand(cwd, 'status --porcelain=v1')
    const staged: GitFileStatus[] = []
    const unstaged: GitFileStatus[] = []
    const untracked: GitFileStatus[] = []
    const conflicted: GitFileStatus[] = []

    for (const line of statusOutput.split('\n')) {
      if (!line) continue
      const indexStatus = line[0]
      const workStatus = line[1]
      const filePath = line.slice(3)

      // Check for conflicts (both modified, or unmerged states)
      if (indexStatus === 'U' || workStatus === 'U' ||
          (indexStatus === 'A' && workStatus === 'A') ||
          (indexStatus === 'D' && workStatus === 'D')) {
        conflicted.push({ path: filePath, status: 'modified', staged: false })
        continue
      }

      // Untracked
      if (indexStatus === '?' && workStatus === '?') {
        untracked.push({ path: filePath, status: 'untracked', staged: false })
        continue
      }

      // Staged changes
      if (indexStatus !== ' ' && indexStatus !== '?') {
        staged.push({ path: filePath, status: parseGitStatusCode(indexStatus), staged: true })
      }

      // Unstaged changes
      if (workStatus !== ' ' && workStatus !== '?') {
        unstaged.push({ path: filePath, status: parseGitStatusCode(workStatus), staged: false })
      }
    }

    // Get stash count
    let stashCount = 0
    try {
      const { stdout: stashOutput } = await runGitCommand(cwd, 'stash list')
      stashCount = stashOutput.split('\n').filter(l => l.trim()).length
    } catch {
      // No stash
    }

    return {
      isRepo: true,
      branch,
      upstream,
      ahead,
      behind,
      staged,
      unstaged,
      untracked,
      conflicted,
      stashCount
    }
  } catch {
    return defaultStatus
  }
}

async function getGitBranches(cwd: string): Promise<GitBranch[]> {
  try {
    const { stdout } = await runGitCommand(cwd, 'branch -a --format="%(HEAD)|%(refname:short)|%(upstream:short)"')
    const branches: GitBranch[] = []

    for (const line of stdout.split('\n')) {
      if (!line.trim()) continue
      const [head, name, upstream] = line.split('|')
      const isRemote = name.startsWith('remotes/')
      branches.push({
        name: isRemote ? name.replace('remotes/', '') : name,
        current: head === '*',
        remote: isRemote,
        upstream: upstream || null
      })
    }

    return branches
  } catch {
    return []
  }
}

// ── Git operations ───────────────────────────────────────────────────────────

async function gitCheckout(cwd: string, branch: string, create = false): Promise<GitOperationResult> {
  try {
    const flag = create ? '-b' : ''
    await runGitCommand(cwd, `checkout ${flag} ${branch}`)
    return { success: true, message: `Switched to branch '${branch}'` }
  } catch (err) {
    const error = err as Error & { stderr?: string }
    return { success: false, message: 'Checkout failed', error: error.stderr || error.message }
  }
}

async function gitPull(cwd: string): Promise<GitOperationResult> {
  try {
    const { stdout } = await runGitCommand(cwd, 'pull')
    return { success: true, message: stdout.trim() || 'Already up to date' }
  } catch (err) {
    const error = err as Error & { stderr?: string }
    return { success: false, message: 'Pull failed', error: error.stderr || error.message }
  }
}

async function gitPush(cwd: string, force = false): Promise<GitOperationResult> {
  try {
    const flag = force ? '--force-with-lease' : ''
    const { stdout, stderr } = await runGitCommand(cwd, `push ${flag}`)
    return { success: true, message: stdout.trim() || stderr.trim() || 'Pushed successfully' }
  } catch (err) {
    const error = err as Error & { stderr?: string }
    return { success: false, message: 'Push failed', error: error.stderr || error.message }
  }
}

async function gitFetch(cwd: string): Promise<GitOperationResult> {
  try {
    await runGitCommand(cwd, 'fetch --all --prune')
    return { success: true, message: 'Fetched successfully' }
  } catch (err) {
    const error = err as Error & { stderr?: string }
    return { success: false, message: 'Fetch failed', error: error.stderr || error.message }
  }
}

async function gitCommit(cwd: string, message: string): Promise<GitOperationResult> {
  try {
    const escapedMessage = message.replace(/"/g, '\\"')
    const { stdout } = await runGitCommand(cwd, `commit -m "${escapedMessage}"`)
    return { success: true, message: stdout.trim() }
  } catch (err) {
    const error = err as Error & { stderr?: string }
    return { success: false, message: 'Commit failed', error: error.stderr || error.message }
  }
}

async function gitStage(cwd: string, files: string[]): Promise<GitOperationResult> {
  try {
    const fileList = files.length === 0 ? '.' : files.map(f => `"${f}"`).join(' ')
    await runGitCommand(cwd, `add ${fileList}`)
    return { success: true, message: 'Files staged' }
  } catch (err) {
    const error = err as Error & { stderr?: string }
    return { success: false, message: 'Stage failed', error: error.stderr || error.message }
  }
}

async function gitUnstage(cwd: string, files: string[]): Promise<GitOperationResult> {
  try {
    const fileList = files.length === 0 ? '.' : files.map(f => `"${f}"`).join(' ')
    await runGitCommand(cwd, `reset HEAD ${fileList}`)
    return { success: true, message: 'Files unstaged' }
  } catch (err) {
    const error = err as Error & { stderr?: string }
    return { success: false, message: 'Unstage failed', error: error.stderr || error.message }
  }
}

async function gitStash(cwd: string, message?: string): Promise<GitOperationResult> {
  try {
    const msgFlag = message ? `-m "${message.replace(/"/g, '\\"')}"` : ''
    await runGitCommand(cwd, `stash push ${msgFlag}`)
    return { success: true, message: 'Changes stashed' }
  } catch (err) {
    const error = err as Error & { stderr?: string }
    return { success: false, message: 'Stash failed', error: error.stderr || error.message }
  }
}

async function gitStashPop(cwd: string, index = 0): Promise<GitOperationResult> {
  try {
    await runGitCommand(cwd, `stash pop stash@{${index}}`)
    return { success: true, message: 'Stash applied and dropped' }
  } catch (err) {
    const error = err as Error & { stderr?: string }
    return { success: false, message: 'Stash pop failed', error: error.stderr || error.message }
  }
}

async function getGitStashList(cwd: string): Promise<GitStashEntry[]> {
  try {
    const { stdout } = await runGitCommand(cwd, 'stash list --format="%gd|%s"')
    const entries: GitStashEntry[] = []

    for (const line of stdout.split('\n')) {
      if (!line.trim()) continue
      const [indexPart, ...messageParts] = line.split('|')
      const indexMatch = indexPart.match(/stash@\{(\d+)\}/)
      const stashIndex = indexMatch ? parseInt(indexMatch[1], 10) : entries.length
      const message = messageParts.join('|')
      const branchMatch = message.match(/On ([^:]+):/)
      entries.push({
        index: stashIndex,
        message: message.replace(/On [^:]+:\s*/, ''),
        branch: branchMatch ? branchMatch[1] : ''
      })
    }

    return entries
  } catch {
    return []
  }
}

async function gitDiscard(cwd: string, files: string[]): Promise<GitOperationResult> {
  try {
    const fileList = files.map(f => `"${f}"`).join(' ')
    await runGitCommand(cwd, `checkout -- ${fileList}`)
    return { success: true, message: 'Changes discarded' }
  } catch (err) {
    const error = err as Error & { stderr?: string }
    return { success: false, message: 'Discard failed', error: error.stderr || error.message }
  }
}

// ── Git repo scanning ────────────────────────────────────────────────────────

async function scanGitRepos(baseDir: string): Promise<GitRepoInfo[]> {
  const repos: GitRepoInfo[] = []
  const expandedDir = baseDir.replace(/^~/, os.homedir())

  async function checkForGitRepo(dirPath: string): Promise<boolean> {
    try {
      const gitPath = join(dirPath, '.git')
      const gitStat = await stat(gitPath)
      return gitStat.isDirectory()
    } catch {
      return false
    }
  }

  async function scanDirectory(dir: string, depth: number): Promise<void> {
    if (depth > 2) return

    try {
      const entries = await readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        // Skip hidden directories
        if (entry.name.startsWith('.')) continue

        const dirPath = join(dir, entry.name)

        // Check if this directory is a git repo
        if (await checkForGitRepo(dirPath)) {
          repos.push({
            path: dirPath,
            name: basename(dirPath)
          })
          // Don't scan inside git repos
          continue
        }

        // If not a repo and we haven't reached max depth, scan deeper
        if (depth < 2) {
          await scanDirectory(dirPath, depth + 1)
        }
      }
    } catch {
      // Directory not accessible, skip
    }
  }

  try {
    // Check if base directory exists
    await access(expandedDir, fs.constants.R_OK)
    await scanDirectory(expandedDir, 1)

    // Sort alphabetically by name
    repos.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
  } catch {
    // Directory doesn't exist or not accessible
  }

  return repos
}

// ── IPC registration ─────────────────────────────────────────────────────────

export function registerGitHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.GIT_STATUS, (_event, cwd: string) => {
    return getGitStatus(cwd)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_BRANCHES, (_event, cwd: string) => {
    return getGitBranches(cwd)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_CHECKOUT, (_event, cwd: string, branch: string, create?: boolean) => {
    return gitCheckout(cwd, branch, create)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_PULL, (_event, cwd: string) => {
    return gitPull(cwd)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_PUSH, (_event, cwd: string, force?: boolean) => {
    return gitPush(cwd, force)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_FETCH, (_event, cwd: string) => {
    return gitFetch(cwd)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_COMMIT, (_event, cwd: string, message: string) => {
    return gitCommit(cwd, message)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_STAGE, (_event, cwd: string, files: string[]) => {
    return gitStage(cwd, files)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_UNSTAGE, (_event, cwd: string, files: string[]) => {
    return gitUnstage(cwd, files)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_STASH, (_event, cwd: string, message?: string) => {
    return gitStash(cwd, message)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_STASH_POP, (_event, cwd: string, index?: number) => {
    return gitStashPop(cwd, index)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_STASH_LIST, (_event, cwd: string) => {
    return getGitStashList(cwd)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_DISCARD, (_event, cwd: string, files: string[]) => {
    return gitDiscard(cwd, files)
  })

  ipcMain.handle(IPC_CHANNELS.SCAN_GIT_REPOS, (_event, baseDir: string) => {
    return scanGitRepos(baseDir)
  })
}
