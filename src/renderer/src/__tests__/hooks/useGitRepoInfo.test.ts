import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGitRepoInfo } from '../../hooks/useGitRepoInfo'
import type { GitRepoInfoResult } from '@shared/ipc'

const repoResult: GitRepoInfoResult = {
  isRepo: true,
  repoName: 'my-project',
  branch: 'main'
}

const notRepoResult: GitRepoInfoResult = {
  isRepo: false,
  repoName: '',
  branch: ''
}

/** Flush microtasks so resolved promises settle within act() */
async function flushPromises() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

describe('useGitRepoInfo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(window.electronAPI.gitRepoInfo).mockReset()
    vi.mocked(window.electronAPI.gitRepoInfo).mockResolvedValue(repoResult)
    Object.defineProperty(document, 'hidden', { value: false, writable: true, configurable: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null initially before fetch resolves', () => {
    const { result } = renderHook(() => useGitRepoInfo('/path/to/repo'))
    expect(result.current).toBeNull()
  })

  it('fetches and returns git repo info for a given CWD', async () => {
    const { result } = renderHook(() => useGitRepoInfo('/path/to/repo'))

    await flushPromises()

    expect(result.current).toEqual(repoResult)
    expect(window.electronAPI.gitRepoInfo).toHaveBeenCalledWith('/path/to/repo')
  })

  it('returns non-repo result for a non-repo directory', async () => {
    vi.mocked(window.electronAPI.gitRepoInfo).mockResolvedValue(notRepoResult)

    const { result } = renderHook(() => useGitRepoInfo('/tmp/not-a-repo'))

    await flushPromises()

    expect(result.current).toEqual(notRepoResult)
  })

  it('returns null and does not fetch when CWD is undefined', async () => {
    vi.mocked(window.electronAPI.gitRepoInfo).mockClear()

    const { result } = renderHook(() => useGitRepoInfo(undefined))

    await flushPromises()

    expect(result.current).toBeNull()
    expect(window.electronAPI.gitRepoInfo).not.toHaveBeenCalled()
  })

  it('clears info when CWD changes to undefined', async () => {
    const { result, rerender } = renderHook(
      ({ cwd }: { cwd: string | undefined }) => useGitRepoInfo(cwd),
      { initialProps: { cwd: '/path/to/repo' as string | undefined } }
    )

    await flushPromises()
    expect(result.current).toEqual(repoResult)

    rerender({ cwd: undefined })
    await flushPromises()

    expect(result.current).toBeNull()
  })

  it('fetches new info when CWD changes', async () => {
    const secondRepo: GitRepoInfoResult = {
      isRepo: true,
      repoName: 'other-project',
      branch: 'develop'
    }

    vi.mocked(window.electronAPI.gitRepoInfo)
      .mockResolvedValueOnce(repoResult)
      .mockResolvedValueOnce(secondRepo)

    const { result, rerender } = renderHook(
      ({ cwd }: { cwd: string }) => useGitRepoInfo(cwd),
      { initialProps: { cwd: '/path/to/repo' } }
    )

    await flushPromises()
    expect(result.current).toEqual(repoResult)

    rerender({ cwd: '/path/to/other' })
    await flushPromises()

    expect(result.current).toEqual(secondRepo)
    expect(window.electronAPI.gitRepoInfo).toHaveBeenCalledWith('/path/to/other')
  })

  it('does not flicker — keeps old info while new fetch is in-flight', async () => {
    let resolveSecond!: (v: GitRepoInfoResult) => void
    const secondPromise = new Promise<GitRepoInfoResult>((r) => { resolveSecond = r })

    vi.mocked(window.electronAPI.gitRepoInfo)
      .mockResolvedValueOnce(repoResult)
      .mockReturnValueOnce(secondPromise)

    const { result, rerender } = renderHook(
      ({ cwd }: { cwd: string }) => useGitRepoInfo(cwd),
      { initialProps: { cwd: '/repo-a' } }
    )

    // First fetch resolves
    await flushPromises()
    expect(result.current).toEqual(repoResult)

    // Change CWD — second fetch is now in-flight (pending promise)
    rerender({ cwd: '/repo-b' })
    await flushPromises()

    // While the second fetch is pending, the first result should still be shown (no null flash)
    expect(result.current).toEqual(repoResult)

    // Now resolve the second fetch
    const newResult: GitRepoInfoResult = { isRepo: true, repoName: 'repo-b', branch: 'feat' }
    await act(async () => {
      resolveSecond(newResult)
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(result.current).toEqual(newResult)
  })

  it('discards stale results when CWD changed during fetch', async () => {
    let resolveFirst!: (v: GitRepoInfoResult) => void
    const firstPromise = new Promise<GitRepoInfoResult>((r) => { resolveFirst = r })

    const fastResult: GitRepoInfoResult = { isRepo: true, repoName: 'fast-repo', branch: 'main' }
    const staleResult: GitRepoInfoResult = { isRepo: true, repoName: 'stale-repo', branch: 'old' }

    vi.mocked(window.electronAPI.gitRepoInfo)
      .mockReturnValueOnce(firstPromise)    // slow for /repo-a
      .mockResolvedValueOnce(fastResult)    // fast for /repo-b

    const { result, rerender } = renderHook(
      ({ cwd }: { cwd: string }) => useGitRepoInfo(cwd),
      { initialProps: { cwd: '/repo-a' } }
    )

    // Quickly change CWD before first fetch resolves
    rerender({ cwd: '/repo-b' })

    // Second fetch resolves immediately
    await flushPromises()
    expect(result.current).toEqual(fastResult)

    // Now the first (stale) fetch resolves — should be discarded
    await act(async () => {
      resolveFirst(staleResult)
      await vi.advanceTimersByTimeAsync(0)
    })

    // Result should still be the fast one, not the stale one
    expect(result.current).toEqual(fastResult)
  })

  it('handles fetch errors gracefully', async () => {
    vi.mocked(window.electronAPI.gitRepoInfo).mockRejectedValue(new Error('IPC error'))

    const { result } = renderHook(() => useGitRepoInfo('/some/path'))

    await flushPromises()

    expect(result.current).toBeNull()
  })

  it('polls on interval for branch changes', async () => {
    const { result } = renderHook(() => useGitRepoInfo('/path/to/repo'))

    // Initial fetch
    await flushPromises()
    expect(result.current).toEqual(repoResult)

    // Clear to track subsequent calls
    vi.mocked(window.electronAPI.gitRepoInfo).mockClear()

    const updatedResult: GitRepoInfoResult = { isRepo: true, repoName: 'my-project', branch: 'feature/new' }
    vi.mocked(window.electronAPI.gitRepoInfo).mockResolvedValue(updatedResult)

    // Advance past poll interval (10s)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })

    expect(window.electronAPI.gitRepoInfo).toHaveBeenCalledTimes(1)
    expect(result.current).toEqual(updatedResult)
  })

  it('skips polling when document is hidden', async () => {
    const { result } = renderHook(() => useGitRepoInfo('/path/to/repo'))

    await flushPromises()
    expect(result.current).toEqual(repoResult)

    vi.mocked(window.electronAPI.gitRepoInfo).mockClear()
    Object.defineProperty(document, 'hidden', { value: true, writable: true, configurable: true })

    // Advance past poll interval
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })

    expect(window.electronAPI.gitRepoInfo).not.toHaveBeenCalled()
  })

  it('cleans up interval on unmount', async () => {
    const { result, unmount } = renderHook(() => useGitRepoInfo('/path/to/repo'))

    await flushPromises()
    expect(result.current).toEqual(repoResult)

    vi.mocked(window.electronAPI.gitRepoInfo).mockClear()
    unmount()

    // Advance past poll interval — should not trigger any fetch
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })

    expect(window.electronAPI.gitRepoInfo).not.toHaveBeenCalled()
  })

  it('does not re-fetch when CWD is the same on rerender', async () => {
    const { result, rerender } = renderHook(
      ({ cwd }: { cwd: string }) => useGitRepoInfo(cwd),
      { initialProps: { cwd: '/path/to/repo' } }
    )

    await flushPromises()
    expect(result.current).toEqual(repoResult)

    vi.mocked(window.electronAPI.gitRepoInfo).mockClear()

    // Rerender with the same CWD — effect should not re-run
    rerender({ cwd: '/path/to/repo' })

    expect(window.electronAPI.gitRepoInfo).not.toHaveBeenCalled()
  })
})
