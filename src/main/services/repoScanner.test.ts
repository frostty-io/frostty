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

      const repos = await scanGitRepos(base)
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
})
