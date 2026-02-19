import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSystemStats } from '../../hooks/useSystemStats'

describe('useSystemStats', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(window.electronAPI.getSystemStats).mockReset()
    Object.defineProperty(document, 'hidden', { value: false, writable: true, configurable: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('dedupes overlapping fetches while one request is in-flight', async () => {
    let resolveStats!: (value: { cpuUsage: number; memoryUsage: number; memoryUsedGb: number; memoryTotalGb: number }) => void
    const pending = new Promise<{ cpuUsage: number; memoryUsage: number; memoryUsedGb: number; memoryTotalGb: number }>((resolve) => {
      resolveStats = resolve
    })
    vi.mocked(window.electronAPI.getSystemStats).mockReturnValue(pending)

    const { result } = renderHook(() => useSystemStats())

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(window.electronAPI.getSystemStats).toHaveBeenCalledTimes(1)
    expect(result.current).toBeNull()

    await act(async () => {
      resolveStats({ cpuUsage: 10, memoryUsage: 40, memoryUsedGb: 8, memoryTotalGb: 16 })
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(result.current?.cpuUsage).toBe(10)
  })

  it('skips fetches when the document is hidden', async () => {
    vi.mocked(window.electronAPI.getSystemStats).mockResolvedValue({
      cpuUsage: 20,
      memoryUsage: 50,
      memoryUsedGb: 8,
      memoryTotalGb: 16
    })

    renderHook(() => useSystemStats())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    vi.mocked(window.electronAPI.getSystemStats).mockClear()
    Object.defineProperty(document, 'hidden', { value: true, writable: true, configurable: true })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(window.electronAPI.getSystemStats).not.toHaveBeenCalled()
  })
})
