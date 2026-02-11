import { useState, useEffect, useCallback } from 'react'

interface UseRecentItemsOptions {
  /** Whether the parent is open / active (triggers reload) */
  active: boolean
  /** 'commands' or 'projects' */
  type: 'commands' | 'projects'
}

export function useRecentItems({ active, type }: UseRecentItemsOptions) {
  const [recentIds, setRecentIds] = useState<string[]>([])

  useEffect(() => {
    if (active) {
      window.electronAPI.loadRecents().then((recents) => {
        setRecentIds(type === 'commands' ? recents.recentCommands : recents.recentProjects)
      })
    }
  }, [active, type])

  const saveRecent = useCallback(
    async (id: string) => {
      if (type === 'commands') {
        await window.electronAPI.saveRecentCommand(id)
      } else {
        await window.electronAPI.saveRecentProject(id)
      }
      const recents = await window.electronAPI.loadRecents()
      setRecentIds(type === 'commands' ? recents.recentCommands : recents.recentProjects)
    },
    [type]
  )

  return { recentIds, saveRecent }
}
