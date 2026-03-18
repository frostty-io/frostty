import type { GitBranch } from '../../shared/ipc'

type RunGitCommand = (cwd: string, args: string) => Promise<{ stdout: string; stderr: string }>

function quoteShellArg(input: string): string {
  return `'${input.replace(/'/g, `'\"'\"'`)}'`
}

function toLocalBranchName(remoteBranch: string): string {
  return remoteBranch.replace(/^[^/]+\//, '')
}

async function gitRefExists(cwd: string, ref: string, runGitCommand: RunGitCommand): Promise<boolean> {
  try {
    await runGitCommand(cwd, `show-ref --verify --quiet ${quoteShellArg(ref)}`)
    return true
  } catch {
    return false
  }
}

async function resolveRemoteBranch(branch: string, cwd: string, runGitCommand: RunGitCommand): Promise<string | null> {
  if (await gitRefExists(cwd, `refs/remotes/${branch}`, runGitCommand)) {
    return branch
  }

  if (await gitRefExists(cwd, `refs/remotes/origin/${branch}`, runGitCommand)) {
    return `origin/${branch}`
  }

  return null
}

export function parseGitBranches(stdout: string): GitBranch[] {
  const branches: GitBranch[] = []

  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue

    const [head, refName, shortName, upstream] = line.split('|')
    if (!refName || !shortName || refName.endsWith('/HEAD')) continue

    branches.push({
      name: shortName,
      current: head === '*',
      remote: refName.startsWith('refs/remotes/'),
      upstream: upstream || null
    })
  }

  return branches
}

export async function resolveGitCheckout(
  cwd: string,
  branch: string,
  create: boolean,
  runGitCommand: RunGitCommand
): Promise<{ args: string; message: string }> {
  if (create) {
    return {
      args: `checkout -b ${quoteShellArg(branch)}`,
      message: `Switched to branch '${branch}'`
    }
  }

  if (await gitRefExists(cwd, `refs/heads/${branch}`, runGitCommand)) {
    return {
      args: `checkout ${quoteShellArg(branch)}`,
      message: `Switched to branch '${branch}'`
    }
  }

  const remoteBranch = await resolveRemoteBranch(branch, cwd, runGitCommand)
  if (remoteBranch) {
    const localBranch = toLocalBranchName(remoteBranch)
    return {
      args: `checkout --track ${quoteShellArg(remoteBranch)}`,
      message: `Switched to branch '${localBranch}' tracking '${remoteBranch}'`
    }
  }

  return {
    args: `checkout ${quoteShellArg(branch)}`,
    message: `Switched to branch '${branch}'`
  }
}
