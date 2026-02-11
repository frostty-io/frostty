import * as os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'
import { ipcMain } from 'electron'
import { IPC_CHANNELS, SystemStats } from '../shared/ipc'

const execAsync = promisify(exec)

// ── CPU usage calculation ────────────────────────────────────────────────────

let previousCpuInfo = os.cpus()

function getCpuUsage(): number {
  const currentCpuInfo = os.cpus()
  let totalIdle = 0
  let totalTick = 0

  for (let i = 0; i < currentCpuInfo.length; i++) {
    const prevCpu = previousCpuInfo[i]
    const currCpu = currentCpuInfo[i]

    const prevTotal = Object.values(prevCpu.times).reduce((a, b) => a + b, 0)
    const currTotal = Object.values(currCpu.times).reduce((a, b) => a + b, 0)

    totalIdle += currCpu.times.idle - prevCpu.times.idle
    totalTick += currTotal - prevTotal
  }

  previousCpuInfo = currentCpuInfo
  const usage = totalTick > 0 ? ((totalTick - totalIdle) / totalTick) * 100 : 0
  return Math.round(usage)
}

// ── macOS memory stats ───────────────────────────────────────────────────────

async function getMacMemoryUsage(): Promise<{ usedBytes: number; totalBytes: number }> {
  const totalBytes = os.totalmem()

  try {
    const { stdout: vmStatOutput } = await execAsync('vm_stat', { encoding: 'utf8' })

    // Parse page size (usually 16384 on Apple Silicon, 4096 on Intel)
    const pageSizeMatch = vmStatOutput.match(/page size of (\d+) bytes/)
    const pageSize = pageSizeMatch ? parseInt(pageSizeMatch[1], 10) : 16384

    // Parse page counts
    const parsePages = (key: string): number => {
      const regex = new RegExp(`${key}:\\s+(\\d+)`)
      const match = vmStatOutput.match(regex)
      return match ? parseInt(match[1], 10) : 0
    }

    // Activity Monitor "Memory Used" = wired + active + compressed + speculative - purgeable
    // This matches what macOS shows in the memory pressure graph
    const wired = parsePages('Pages wired down')
    const active = parsePages('Pages active')
    const compressed = parsePages('Pages occupied by compressor')
    const speculative = parsePages('Pages speculative')
    const purgeable = parsePages('Pages purgeable')

    const usedPages = wired + active + compressed + speculative - purgeable
    const usedBytes = usedPages * pageSize

    return { usedBytes, totalBytes }
  } catch {
    // Fallback to basic calculation if vm_stat fails
    const freeMem = os.freemem()
    return { usedBytes: totalBytes - freeMem, totalBytes }
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

async function getSystemStats(): Promise<SystemStats> {
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

  return {
    cpuUsage: getCpuUsage(),
    memoryUsage: Math.round((usedMem / totalMem) * 100),
    memoryUsedGb: Math.round((usedMem / (1024 * 1024 * 1024)) * 10) / 10,
    memoryTotalGb: Math.round((totalMem / (1024 * 1024 * 1024)) * 10) / 10
  }
}

// ── IPC registration ─────────────────────────────────────────────────────────

export function registerSystemHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SYSTEM_STATS, () => {
    return getSystemStats()
  })
}
