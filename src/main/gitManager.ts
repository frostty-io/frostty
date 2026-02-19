import { exec } from 'child_process'
import { promisify } from 'util'
import * as os from 'os'
import { basename } from 'path'
import { ipcMain } from 'electron'
import {
  IPC_CHANNELS,
  GitRepoInfoResult,
  GitStatus,
  GitBranch,
  GitOperationResult,
  GitStashEntry
} from '../shared/ipc'
import { GIT_MAX_BUFFER } from '../shared/constants'
import { getGitStatusViaPorcelainV2 } from './services/gitStatusService'
import { scanGitRepos } from './services/repoScanner'

const execAsync = promisify(exec)

// Escape a string for safe inclusion inside double quotes in a shell command line.
// This function first escapes backslashes, then double quotes.
function escapeShellDoubleQuoted(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

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

// ── Lightweight repo info (for tab display) ─────────────────────────────────

async function getGitRepoInfo(cwd: string): Promise<GitRepoInfoResult> {
  const notRepo: GitRepoInfoResult = { isRepo: false, repoName: '', branch: '' }
  try {
    const { stdout: toplevel } = await runGitCommand(cwd, 'rev-parse --show-toplevel')
    const repoName = basename(toplevel.trim())
    const { stdout: branchOutput } = await runGitCommand(cwd, 'branch --show-current')
    const branch = branchOutput.trim() || 'HEAD'
    return { isRepo: true, repoName, branch }
  } catch {
    return notRepo
  }
}

// ── Git status / branch queries ──────────────────────────────────────────────

async function getGitStatus(cwd: string): Promise<GitStatus> {
  return getGitStatusViaPorcelainV2(cwd, runGitCommand)
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
    const escapedMessage = escapeShellDoubleQuoted(message)
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
    const msgFlag = message ? `-m "${escapeShellDoubleQuoted(message)}"` : ''
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

// ── IPC registration ─────────────────────────────────────────────────────────

export function registerGitHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.GIT_REPO_INFO, (_event, cwd: string) => {
    return getGitRepoInfo(cwd)
  })

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
