import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc'
import { getSystemStats } from './services/systemStatsService'

// ── IPC registration ─────────────────────────────────────────────────────────

export function registerSystemHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SYSTEM_STATS, () => {
    return getSystemStats()
  })
}
