import * as os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'
import type { SystemStats } from '../../shared/ipc'
import { SYSTEM_STATS_CACHE_MS } from '../../shared/constants'

const execAsync = promisify(exec)

export interface SystemStatsSnapshotCache {
  value: SystemStats | null
  timestamp: number
  inFlight: Promise<SystemStats> | null
}

export function calculateCpuUsage(previousCpuInfo: os.CpuInfo[], currentCpuInfo: os.CpuInfo[]): number {
  let totalIdle = 0
  let totalTick = 0

  for (let i = 0; i < currentCpuInfo.length; i++) {
    const prevCpu = previousCpuInfo[i]
    const currCpu = currentCpuInfo[i]
    if (!prevCpu || !currCpu) continue

    const prevTotal = Object.values(prevCpu.times).reduce((a, b) => a + b, 0)
    const currTotal = Object.values(currCpu.times).reduce((a, b) => a + b, 0)
    totalIdle += currCpu.times.idle - prevCpu.times.idle
    totalTick += currTotal - prevTotal
  }

  const usage = totalTick > 0 ? ((totalTick - totalIdle) / totalTick) * 100 : 0
  return Math.round(usage)
}

function parseVmStatPages(output: string, key: string): number {
  const regex = new RegExp(`${key}:\\s+(\\d+)\\.?`)
  const match = output.match(regex)
  return match ? parseInt(match[1], 10) : 0
}

export function parseVmStatMemoryUsage(output: string, totalBytes: number): { usedBytes: number; totalBytes: number } {
  const pageSizeMatch = output.match(/page size of (\d+) bytes/)
  const pageSize = pageSizeMatch ? parseInt(pageSizeMatch[1], 10) : 16384

  const wired = parseVmStatPages(output, 'Pages wired down')
  const active = parseVmStatPages(output, 'Pages active')
  const compressed = parseVmStatPages(output, 'Pages occupied by compressor')
  const speculative = parseVmStatPages(output, 'Pages speculative')
  const purgeable = parseVmStatPages(output, 'Pages purgeable')

  const usedPages = wired + active + compressed + speculative - purgeable
  return { usedBytes: usedPages * pageSize, totalBytes }
}

let previousCpuInfo = os.cpus()
const cache: SystemStatsSnapshotCache = {
  value: null,
  timestamp: 0,
  inFlight: null
}

async function getMacMemoryUsage(): Promise<{ usedBytes: number; totalBytes: number }> {
  const totalBytes = os.totalmem()

  try {
    const { stdout } = await execAsync('vm_stat', { encoding: 'utf8' })
    return parseVmStatMemoryUsage(stdout, totalBytes)
  } catch {
    const freeMem = os.freemem()
    return { usedBytes: totalBytes - freeMem, totalBytes }
  }
}

async function defaultGetSystemStatsUncached(): Promise<SystemStats> {
  const isMac = process.platform === 'darwin'

  let usedMem: number
  let totalMem: number
  if (isMac) {
    const macMem = await getMacMemoryUsage()
    usedMem = macMem.usedBytes
    totalMem = macMem.totalBytes
  } else {
    totalMem = os.totalmem()
    usedMem = totalMem - os.freemem()
  }

  const currentCpuInfo = os.cpus()
  const cpuUsage = calculateCpuUsage(previousCpuInfo, currentCpuInfo)
  previousCpuInfo = currentCpuInfo

  return {
    cpuUsage,
    memoryUsage: Math.round((usedMem / totalMem) * 100),
    memoryUsedGb: Math.round((usedMem / (1024 * 1024 * 1024)) * 10) / 10,
    memoryTotalGb: Math.round((totalMem / (1024 * 1024 * 1024)) * 10) / 10
  }
}

let getSystemStatsUncachedImpl: () => Promise<SystemStats> = defaultGetSystemStatsUncached

export async function getSystemStats(cacheMs = SYSTEM_STATS_CACHE_MS): Promise<SystemStats> {
  const now = Date.now()
  if (cache.value && (now - cache.timestamp) < cacheMs) {
    return cache.value
  }

  if (cache.inFlight) {
    return cache.inFlight
  }

  cache.inFlight = getSystemStatsUncachedImpl()
    .then((stats) => {
      cache.value = stats
      cache.timestamp = Date.now()
      return stats
    })
    .finally(() => {
      cache.inFlight = null
    })

  return cache.inFlight
}

export function __resetSystemStatsServiceForTests(): void {
  cache.value = null
  cache.timestamp = 0
  cache.inFlight = null
  previousCpuInfo = os.cpus()
  getSystemStatsUncachedImpl = defaultGetSystemStatsUncached
}

export function __setSystemStatsUncachedForTests(fn: () => Promise<SystemStats>): void {
  getSystemStatsUncachedImpl = fn
}
