import { useState, useEffect, useRef } from 'react'
import { SYSTEM_STATS_POLL_INTERVAL } from '../../../shared/constants'
import type { SystemStats } from '../../../shared/ipc'

export function useSystemStats(): SystemStats | null {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const inFlightRef = useRef(false)

  useEffect(() => {
    const fetchStats = async () => {
      if (document.hidden) return
      if (inFlightRef.current) return
      inFlightRef.current = true
      try {
        const systemStats = await window.electronAPI.getSystemStats()
        setStats(systemStats)
      } catch (err) {
        console.error('Failed to get system stats:', err)
      } finally {
        inFlightRef.current = false
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, SYSTEM_STATS_POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  return stats
}
