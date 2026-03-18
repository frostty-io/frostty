import { describe, expect, it, vi } from 'vitest'
import { parseGitBranches, resolveGitCheckout } from './gitBranchService'

describe('gitBranchService', () => {
  it('classifies local and remote refs correctly', () => {
    const output = [
      '*|refs/heads/main|main|origin/main',
      ' |refs/heads/feature/login|feature/login|origin/feature/login',
      ' |refs/remotes/origin/main|origin/main|',
      ' |refs/remotes/origin/feature/login|origin/feature/login|',
      ' |refs/remotes/origin/HEAD|origin/HEAD|'
    ].join('\n')

    expect(parseGitBranches(output)).toEqual([
      { name: 'main', current: true, remote: false, upstream: 'origin/main' },
      { name: 'feature/login', current: false, remote: false, upstream: 'origin/feature/login' },
      { name: 'origin/main', current: false, remote: true, upstream: null },
      { name: 'origin/feature/login', current: false, remote: true, upstream: null }
    ])
  })

  it('uses a normal checkout for an existing local branch', async () => {
    const runGitCommand = vi.fn(async (_cwd: string, args: string) => {
      if (args.includes("show-ref --verify --quiet 'refs/heads/feature/login'")) {
        return { stdout: '', stderr: '' }
      }

      throw new Error(`unexpected command: ${args}`)
    })

    await expect(resolveGitCheckout('/tmp/repo', 'feature/login', false, runGitCommand)).resolves.toEqual({
      args: "checkout 'feature/login'",
      message: "Switched to branch 'feature/login'"
    })
  })

  it('creates a tracking branch when the target exists only on a remote', async () => {
    const runGitCommand = vi.fn(async (_cwd: string, args: string) => {
      if (args.includes("show-ref --verify --quiet 'refs/heads/feature/login'")) {
        throw new Error('missing local branch')
      }

      if (args.includes("show-ref --verify --quiet 'refs/remotes/origin/feature/login'")) {
        return { stdout: '', stderr: '' }
      }

      throw new Error(`unexpected command: ${args}`)
    })

    await expect(resolveGitCheckout('/tmp/repo', 'origin/feature/login', false, runGitCommand)).resolves.toEqual({
      args: "checkout --track 'origin/feature/login'",
      message: "Switched to branch 'feature/login' tracking 'origin/feature/login'"
    })
  })

  it('falls back to origin when given a short remote branch name', async () => {
    const runGitCommand = vi.fn(async (_cwd: string, args: string) => {
      if (args.includes("show-ref --verify --quiet 'refs/heads/feature/login'")) {
        throw new Error('missing local branch')
      }

      if (args.includes("show-ref --verify --quiet 'refs/remotes/feature/login'")) {
        throw new Error('missing explicit remote branch')
      }

      if (args.includes("show-ref --verify --quiet 'refs/remotes/origin/feature/login'")) {
        return { stdout: '', stderr: '' }
      }

      throw new Error(`unexpected command: ${args}`)
    })

    await expect(resolveGitCheckout('/tmp/repo', 'feature/login', false, runGitCommand)).resolves.toEqual({
      args: "checkout --track 'origin/feature/login'",
      message: "Switched to branch 'feature/login' tracking 'origin/feature/login'"
    })
  })
})
