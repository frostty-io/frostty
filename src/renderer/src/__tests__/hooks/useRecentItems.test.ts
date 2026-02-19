import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useRecentItems } from '../../hooks/useRecentItems'

describe('useRecentItems', () => {
  beforeEach(() => {
    vi.mocked(window.electronAPI.loadRecents).mockResolvedValue({
      recentCommands: ['cmd-1', 'cmd-2'],
      recentProjects: ['/path/a', '/path/b']
    })
  })

  it('loads recent commands when active', async () => {
    const { result } = renderHook(() =>
      useRecentItems({ active: true, type: 'commands' })
    )

    await waitFor(() => {
      expect(result.current.recentIds).toEqual(['cmd-1', 'cmd-2'])
    })
  })

  it('loads recent projects when active', async () => {
    const { result } = renderHook(() =>
      useRecentItems({ active: true, type: 'projects' })
    )

    await waitFor(() => {
      expect(result.current.recentIds).toEqual(['/path/a', '/path/b'])
    })
  })

  it('does not load when not active', () => {
    vi.mocked(window.electronAPI.loadRecents).mockClear()
    renderHook(() => useRecentItems({ active: false, type: 'commands' }))
    expect(window.electronAPI.loadRecents).not.toHaveBeenCalled()
  })

  it('saves a recent command', async () => {
    vi.mocked(window.electronAPI.saveRecentCommand).mockResolvedValue(undefined)

    const { result } = renderHook(() =>
      useRecentItems({ active: true, type: 'commands' })
    )

    await waitFor(() => {
      expect(result.current.recentIds.length).toBeGreaterThan(0)
    })

    await act(async () => {
      await result.current.saveRecent('cmd-new')
    })

    expect(window.electronAPI.saveRecentCommand).toHaveBeenCalledWith('cmd-new')
  })
})
