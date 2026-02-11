import { useState, useEffect } from 'react'
import { SYSTEM_STATS_POLL_INTERVAL } from '../../../shared/constants'
import type { SystemStats } from '../../../shared/ipc'

export function useSystemStats(): SystemStats | null {
  const [stats, setStats] = useState<SystemStats | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      if (document.hidden) return
      try {
        const systemStats = await window.electronAPI.getSystemStats()
        setStats(systemStats)
      } catch (err) {
        console.error('Failed to get system stats:', err)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, SYSTEM_STATS_POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  return stats
}
