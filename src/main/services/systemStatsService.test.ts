import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  __resetSystemStatsServiceForTests,
  __setSystemStatsUncachedForTests,
  calculateCpuUsage,
  getSystemStats,
  parseVmStatMemoryUsage
} from './systemStatsService'

describe('systemStatsService', () => {
  beforeEach(() => {
    __resetSystemStatsServiceForTests()
  })

  it('parses vm_stat output into used bytes', () => {
    const output = [
      'Mach Virtual Memory Statistics: (page size of 4096 bytes)',
      'Pages wired down: 100.',
      'Pages active: 200.',
      'Pages occupied by compressor: 50.',
      'Pages speculative: 25.',
      'Pages purgeable: 10.'
    ].join('\n')

    const parsed = parseVmStatMemoryUsage(output, 1024)
    expect(parsed.usedBytes).toBe((100 + 200 + 50 + 25 - 10) * 4096)
    expect(parsed.totalBytes).toBe(1024)
  })

  it('dedupes concurrent requests through a single in-flight promise', async () => {
    const uncached = vi.fn().mockImplementation(async () => ({
      cpuUsage: 10,
      memoryUsage: 20,
      memoryUsedGb: 4,
      memoryTotalGb: 16
    }))
    __setSystemStatsUncachedForTests(uncached)

    const [a, b] = await Promise.all([getSystemStats(0), getSystemStats(0)])
    expect(uncached).toHaveBeenCalledTimes(1)
    expect(a.cpuUsage).toBe(10)
    expect(b.memoryUsage).toBe(20)
  })

  it('computes cpu usage from previous/current cpu snapshots', () => {
    const previous = [{
      model: '',
      speed: 0,
      times: { user: 100, nice: 0, sys: 50, idle: 850, irq: 0 }
    }]
    const current = [{
      model: '',
      speed: 0,
      times: { user: 200, nice: 0, sys: 100, idle: 900, irq: 0 }
    }]

    expect(calculateCpuUsage(previous, current)).toBe(75)
  })
})
