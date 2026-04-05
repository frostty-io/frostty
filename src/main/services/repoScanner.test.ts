import { describe, it, expect } from 'vitest'
import * as os from 'os'
import * as path from 'path'
import { mkdtemp, mkdir, rm } from 'fs/promises'
import { scanGitRepos } from './repoScanner'

describe('repoScanner', () => {
  it('finds repos up to depth 2 and skips hidden/heavy directories', async () => {
    const base = await mkdtemp(path.join(os.tmpdir(), 'frostty-repos-'))

    try {
      await mkdir(path.join(base, 'repo-a', '.git'), { recursive: true })
      await mkdir(path.join(base, 'group', 'repo-b', '.git'), { recursive: true })
      await mkdir(path.join(base, '.hidden', 'repo-hidden', '.git'), { recursive: true })
      await mkdir(path.join(base, 'node_modules', 'repo-deps', '.git'), { recursive: true })
      await mkdir(path.join(base, 'group', 'nested', 'repo-too-deep', '.git'), { recursive: true })

      const repos = await scanGitRepos([base])
      const names = repos.map((r) => r.name)

      expect(names).toContain('repo-a')
      expect(names).toContain('repo-b')
      expect(names).not.toContain('repo-hidden')
      expect(names).not.toContain('repo-deps')
      expect(names).not.toContain('repo-too-deep')
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })

  it('collects repos from multiple base directories', async () => {
    const baseA = await mkdtemp(path.join(os.tmpdir(), 'frostty-repos-a-'))
    const baseB = await mkdtemp(path.join(os.tmpdir(), 'frostty-repos-b-'))

    try {
      await mkdir(path.join(baseA, 'repo-a', '.git'), { recursive: true })
      await mkdir(path.join(baseB, 'repo-b', '.git'), { recursive: true })

      const repos = await scanGitRepos([baseA, baseB])
      const names = repos.map((r) => r.name)

      expect(names).toContain('repo-a')
      expect(names).toContain('repo-b')
    } finally {
      await rm(baseA, { recursive: true, force: true })
      await rm(baseB, { recursive: true, force: true })
    }
  })

  it('deduplicates repos when the same directory is listed twice', async () => {
    const base = await mkdtemp(path.join(os.tmpdir(), 'frostty-repos-dedup-'))

    try {
      await mkdir(path.join(base, 'repo-a', '.git'), { recursive: true })

      const repos = await scanGitRepos([base, base])
      const repoAPaths = repos.filter((r) => r.name === 'repo-a')

      expect(repoAPaths).toHaveLength(1)
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })

  it('returns an empty array for an empty base directories list', async () => {
    const repos = await scanGitRepos([])
    expect(repos).toEqual([])
  })

  it('skips inaccessible base directories without throwing', async () => {
    const base = await mkdtemp(path.join(os.tmpdir(), 'frostty-repos-valid-'))

    try {
      await mkdir(path.join(base, 'repo-a', '.git'), { recursive: true })

      const repos = await scanGitRepos(['/nonexistent-dir-frostty-test', base])
      const names = repos.map((r) => r.name)

      expect(names).toContain('repo-a')
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })
})
