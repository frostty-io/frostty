import type { GitFileStatus, GitStatus } from '../../shared/ipc'

export interface GitStatusSnapshot {
  branch: string
  upstream: string | null
  ahead: number
  behind: number
  staged: GitFileStatus[]
  unstaged: GitFileStatus[]
  untracked: GitFileStatus[]
  conflicted: GitFileStatus[]
  stashCount: number
}

export interface PorcelainV2HeaderLine {
  kind: 'header'
  key: string
  value: string
}

export interface PorcelainV2StatusLine {
  kind: 'status'
  lineType: '1' | '2' | 'u' | '?' | '!'
  xy: string
  path: string
}

export function createDefaultGitStatus(): GitStatus {
  return {
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
}

export function parseGitStatusCode(code: string): GitFileStatus['status'] {
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

function unquotePath(path: string): string {
  const trimmed = path.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function parsePorcelainLine(line: string): PorcelainV2HeaderLine | PorcelainV2StatusLine | null {
  if (!line.trim()) return null

  if (line.startsWith('# ')) {
    const body = line.slice(2)
    const firstSpace = body.indexOf(' ')
    if (firstSpace === -1) return null
    return {
      kind: 'header',
      key: body.slice(0, firstSpace),
      value: body.slice(firstSpace + 1).trim()
    }
  }

  if (line.startsWith('? ')) {
    return { kind: 'status', lineType: '?', xy: '??', path: unquotePath(line.slice(2)) }
  }

  if (line.startsWith('! ')) {
    return { kind: 'status', lineType: '!', xy: '!!', path: unquotePath(line.slice(2)) }
  }

  const lineType = line[0]
  if (lineType !== '1' && lineType !== '2' && lineType !== 'u') return null

  const tabParts = line.split('\t')
  const firstPart = tabParts[0]
  const parts = firstPart.split(' ')
  const xy = parts[1] || '  '

  if (lineType === '2') {
    const path = tabParts.length > 1 ? tabParts[1] : parts[parts.length - 1]
    return { kind: 'status', lineType, xy, path: unquotePath(path) }
  }

  const path = parts[parts.length - 1]
  return { kind: 'status', lineType, xy, path: unquotePath(path) }
}

export function parsePorcelainV2Status(output: string): GitStatusSnapshot {
  const snapshot: GitStatusSnapshot = {
    branch: 'HEAD',
    upstream: null,
    ahead: 0,
    behind: 0,
    staged: [],
    unstaged: [],
    untracked: [],
    conflicted: [],
    stashCount: 0
  }

  for (const line of output.split('\n')) {
    const parsed = parsePorcelainLine(line)
    if (!parsed) continue

    if (parsed.kind === 'header') {
      if (parsed.key === 'branch.head') {
        snapshot.branch = parsed.value === '(detached)' ? 'HEAD' : parsed.value
      } else if (parsed.key === 'branch.upstream') {
        snapshot.upstream = parsed.value || null
      } else if (parsed.key === 'branch.ab') {
        const match = parsed.value.match(/\+(\d+)\s+-(\d+)/)
        if (match) {
          snapshot.ahead = parseInt(match[1], 10) || 0
          snapshot.behind = parseInt(match[2], 10) || 0
        }
      } else if (parsed.key === 'stash') {
        snapshot.stashCount = parseInt(parsed.value, 10) || 0
      }
      continue
    }

    if (parsed.lineType === '?') {
      snapshot.untracked.push({ path: parsed.path, status: 'untracked', staged: false })
      continue
    }

    if (parsed.lineType === '!') {
      continue
    }

    const rawIndexStatus = parsed.xy[0] || ' '
    const rawWorkStatus = parsed.xy[1] || ' '
    const indexStatus = rawIndexStatus === '.' ? ' ' : rawIndexStatus
    const workStatus = rawWorkStatus === '.' ? ' ' : rawWorkStatus
    const hasConflict = parsed.lineType === 'u' ||
      indexStatus === 'U' || workStatus === 'U' ||
      (indexStatus === 'A' && workStatus === 'A') ||
      (indexStatus === 'D' && workStatus === 'D')

    if (hasConflict) {
      snapshot.conflicted.push({ path: parsed.path, status: 'modified', staged: false })
      continue
    }

    if (indexStatus !== ' ' && indexStatus !== '?') {
      snapshot.staged.push({
        path: parsed.path,
        status: parseGitStatusCode(indexStatus),
        staged: true
      })
    }

    if (workStatus !== ' ' && workStatus !== '?') {
      snapshot.unstaged.push({
        path: parsed.path,
        status: parseGitStatusCode(workStatus),
        staged: false
      })
    }
  }

  return snapshot
}

export async function getGitStatusViaPorcelainV2(
  cwd: string,
  runGitCommand: (cwd: string, args: string) => Promise<{ stdout: string; stderr: string }>
): Promise<GitStatus> {
  const defaultStatus = createDefaultGitStatus()
  try {
    const { stdout } = await runGitCommand(cwd, 'status --porcelain=v2 --branch --show-stash')
    const parsed = parsePorcelainV2Status(stdout)
    return {
      isRepo: true,
      branch: parsed.branch,
      upstream: parsed.upstream,
      ahead: parsed.ahead,
      behind: parsed.behind,
      staged: parsed.staged,
      unstaged: parsed.unstaged,
      untracked: parsed.untracked,
      conflicted: parsed.conflicted,
      stashCount: parsed.stashCount
    }
  } catch {
    return defaultStatus
  }
}
