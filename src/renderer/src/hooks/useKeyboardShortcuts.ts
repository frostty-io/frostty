import { useEffect } from 'react'
import { useTabStore, createPane } from '../stores/useTabStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useUIStore } from '../stores/useUIStore'

/**
 * Global keyboard shortcuts for the application.
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return

      const key = e.key.toLowerCase()
      const shift = e.shiftKey

      const tabStore = useTabStore.getState()
      const settingsStore = useSettingsStore.getState()
      const uiStore = useUIStore.getState()

      // Mod+Shift combos
      if (shift) {
        switch (key) {
          case 'n':
            e.preventDefault()
            window.electronAPI.newWindow()
            return
          case 'w':
            e.preventDefault()
            window.electronAPI.closeWindow()
            return
          case 'p':
            e.preventDefault()
            uiStore.setCommandPaletteOpen(true)
            return
          case 't':
            e.preventDefault()
            tabStore.restoreClosedTab()
            return
        }
        return
      }

      // Mod combos
      switch (e.key) {
        case 't': {
          e.preventDefault()
          const profile = settingsStore.getProfile()
          const pane = createPane(profile.homeDirectory, profile.shell, undefined, profile.id)
          tabStore.addTab(pane)
          uiStore.setSettingsOpen(false)
          return
        }
        case 'd': {
          e.preventDefault()
          const tab = tabStore.getActiveTab()
          if (!tab) return
          if (tab.type === 'single') {
            const activePane = tab.panes.find((p) => p.id === tab.activePaneId) || tab.panes[0]
            const newPane = createPane(activePane.cwd, activePane.shellType, undefined, activePane.profileId)
            tabStore.splitTab(tab.id, newPane)
          } else {
            tabStore.ungroupTab(tab.id)
          }
          return
        }
        case 'w': {
          e.preventDefault()
          if (uiStore.settingsOpen) {
            uiStore.setSettingsOpen(false)
            return
          }
          const tab = tabStore.getActiveTab()
          if (!tab) return
          if (tab.type === 'split') {
            tabStore.closePane(tab.id, tab.activePaneId)
          } else {
            tabStore.closeTabEntry(tab.id)
          }
          return
        }
        case 'ArrowUp': {
          e.preventDefault()
          const tab = tabStore.getActiveTab()
          if (tab && tab.type === 'split' && tab.panes.length > 1) {
            const idx = tab.panes.findIndex((p) => p.id === tab.activePaneId)
            if (idx > 0) {
              tabStore.setActivePaneInTab(tab.id, tab.panes[idx - 1].id)
              return
            }
          }
          tabStore.prevTab()
          return
        }
        case 'ArrowDown': {
          e.preventDefault()
          const tab = tabStore.getActiveTab()
          if (tab && tab.type === 'split' && tab.panes.length > 1) {
            const idx = tab.panes.findIndex((p) => p.id === tab.activePaneId)
            if (idx < tab.panes.length - 1) {
              tabStore.setActivePaneInTab(tab.id, tab.panes[idx + 1].id)
              return
            }
          }
          tabStore.nextTab()
          return
        }
        case ',':
          e.preventDefault()
          uiStore.toggleSettings()
          return
        case 'p':
          e.preventDefault()
          uiStore.setProjectPaletteOpen(true)
          return
        case 'k': {
          e.preventDefault()
          const tab = tabStore.getActiveTab()
          if (!tab) return
          const ref = tabStore.terminalRefs.get(tab.activePaneId)
          ref?.enterAIMode()
          return
        }
        case 'l': {
          e.preventDefault()
          const tab = tabStore.getActiveTab()
          if (!tab) return
          const ref = tabStore.terminalRefs.get(tab.activePaneId)
          ref?.clear()
          return
        }
      }

      // Mod+1..9 — switch to tab by index
      if (e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        tabStore.switchToTabByIndex(parseInt(e.key, 10) - 1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
