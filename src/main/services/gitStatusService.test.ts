import { describe, it, expect, vi } from 'vitest'
import {
  createDefaultGitStatus,
  getGitStatusViaPorcelainV2,
  parsePorcelainV2Status
} from './gitStatusService'

describe('gitStatusService', () => {
  it('parses branch, ahead/behind, stash, and file buckets', () => {
    const output = [
      '# branch.oid abcdef',
      '# branch.head main',
      '# branch.upstream origin/main',
      '# branch.ab +2 -1',
      '# stash 3',
      '1 M. N... 100644 100644 100644 abc def file-staged.txt',
      '1 .M N... 100644 100644 100644 abc def file-unstaged.txt',
      '? file-untracked.txt',
      'u UU N... 100644 100644 100644 100644 abc def ghi conflicted.txt'
    ].join('\n')

    const parsed = parsePorcelainV2Status(output)
    expect(parsed.branch).toBe('main')
    expect(parsed.upstream).toBe('origin/main')
    expect(parsed.ahead).toBe(2)
    expect(parsed.behind).toBe(1)
    expect(parsed.stashCount).toBe(3)
    expect(parsed.staged.map((f) => f.path)).toEqual(['file-staged.txt'])
    expect(parsed.unstaged.map((f) => f.path)).toEqual(['file-unstaged.txt'])
    expect(parsed.untracked.map((f) => f.path)).toEqual(['file-untracked.txt'])
    expect(parsed.conflicted.map((f) => f.path)).toEqual(['conflicted.txt'])
  })

  it('normalizes detached HEAD', () => {
    const output = [
      '# branch.oid abcdef',
      '# branch.head (detached)'
    ].join('\n')

    const parsed = parsePorcelainV2Status(output)
    expect(parsed.branch).toBe('HEAD')
  })

  it('returns default status when porcelain command fails', async () => {
    const runGit = vi.fn().mockRejectedValue(new Error('not a repo'))
    const status = await getGitStatusViaPorcelainV2('/tmp', runGit)
    expect(status).toEqual(createDefaultGitStatus())
  })

  it('maps parsed status into GitStatus response when command succeeds', async () => {
    const runGit = vi.fn().mockResolvedValue({
      stdout: '# branch.head main\n? test.txt',
      stderr: ''
    })

    const status = await getGitStatusViaPorcelainV2('/tmp', runGit)
    expect(status.isRepo).toBe(true)
    expect(status.branch).toBe('main')
    expect(status.untracked).toHaveLength(1)
    expect(status.untracked[0].path).toBe('test.txt')
  })
})
