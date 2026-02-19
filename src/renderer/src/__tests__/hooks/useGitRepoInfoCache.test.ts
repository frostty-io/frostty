import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGitRepoInfo, __clearGitRepoInfoCacheForTests } from '../../hooks/useGitRepoInfo'
import type { GitRepoInfoResult } from '@shared/ipc'

const repoResult: GitRepoInfoResult = {
  isRepo: true,
  repoName: 'frostty',
  branch: 'main'
}

async function flushPromises() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

describe('useGitRepoInfo cache dedupe', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    __clearGitRepoInfoCacheForTests()
    vi.mocked(window.electronAPI.gitRepoInfo).mockReset()
    Object.defineProperty(document, 'hidden', { value: false, writable: true, configurable: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('dedupes in-flight fetches for the same cwd across hooks', async () => {
    let resolveFetch!: (result: GitRepoInfoResult) => void
    const pending = new Promise<GitRepoInfoResult>((resolve) => {
      resolveFetch = resolve
    })
    vi.mocked(window.electronAPI.gitRepoInfo).mockReturnValue(pending)

    const hookA = renderHook(() => useGitRepoInfo('/repo/a'))
    const hookB = renderHook(() => useGitRepoInfo('/repo/a'))

    await flushPromises()
    expect(window.electronAPI.gitRepoInfo).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveFetch(repoResult)
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(hookA.result.current).toEqual(repoResult)
    expect(hookB.result.current).toEqual(repoResult)
  })

  it('reuses fresh cache for subsequent hook mounts', async () => {
    vi.mocked(window.electronAPI.gitRepoInfo).mockResolvedValue(repoResult)

    const first = renderHook(() => useGitRepoInfo('/repo/cached'))
    await flushPromises()
    expect(first.result.current).toEqual(repoResult)
    expect(window.electronAPI.gitRepoInfo).toHaveBeenCalledTimes(1)

    const second = renderHook(() => useGitRepoInfo('/repo/cached'))
    await flushPromises()

    expect(second.result.current).toEqual(repoResult)
    expect(window.electronAPI.gitRepoInfo).toHaveBeenCalledTimes(1)
  })
})
