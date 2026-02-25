import { useEffect } from 'react'
import { useTabStore, createPane } from '../stores/useTabStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useUIStore } from '../stores/useUIStore'
import {
  clampShellFontSize,
  TERMINAL_FONT_SIZE_DEFAULT,
  TERMINAL_FONT_SIZE_STEP
} from '../../../shared/constants'
import { findMatchingShortcutAction, isMacPlatform } from '@/lib/shortcutRegistry'

function isPrimaryModifierPressed(event: KeyboardEvent, isMac: boolean): boolean {
  return isMac
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey
}

/**
 * Global keyboard shortcuts for the application.
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const isMac = typeof navigator !== 'undefined' && isMacPlatform(navigator.platform)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return

      const tabStore = useTabStore.getState()
      const settingsStore = useSettingsStore.getState()
      const uiStore = useUIStore.getState()

      const activePane = tabStore.getActivePane()
      const targetProfile = settingsStore.getProfile(activePane?.profileId)
      const currentShellFontSize = clampShellFontSize(targetProfile.shellFontSize)
      const isZoomIn = e.key === '=' || e.key === '+' || e.code === 'NumpadAdd'
      const isZoomOut = e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract'
      const isZoomReset = e.key === '0' || e.code === 'Numpad0'
      const hasPrimaryModifier = isPrimaryModifierPressed(e, isMac)

      // Shell text zoom shortcuts (prevent browser-level zoom)
      if (hasPrimaryModifier && !e.altKey && (isZoomIn || isZoomOut || isZoomReset)) {
        e.preventDefault()

        const nextShellFontSize = isZoomReset
          ? TERMINAL_FONT_SIZE_DEFAULT
          : clampShellFontSize(
            currentShellFontSize + (isZoomIn ? TERMINAL_FONT_SIZE_STEP : -TERMINAL_FONT_SIZE_STEP)
          )

        if (nextShellFontSize !== currentShellFontSize) {
          settingsStore.updateProfile({
            ...targetProfile,
            shellFontSize: nextShellFontSize
          })
        }
        return
      }

      const actionId = findMatchingShortcutAction(e, isMac)
      if (actionId) {
        e.preventDefault()
        switch (actionId) {
          case 'newWindow':
            window.electronAPI.newWindow()
            return
          case 'newTab': {
            const profile = settingsStore.getProfile()
            const pane = createPane(profile.homeDirectory, profile.shell, undefined, profile.id)
            tabStore.addTab(pane)
            uiStore.setSettingsOpen(false)
            return
          }
          case 'closeTab': {
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
          case 'closeWindow':
            window.electronAPI.closeWindow()
            return
          case 'restoreClosedTab':
            tabStore.restoreClosedTab()
            return
          case 'splitOrUngroup': {
            const tab = tabStore.getActiveTab()
            if (!tab) return
            if (tab.type === 'single') {
              const pane = tab.panes.find((p) => p.id === tab.activePaneId) || tab.panes[0]
              const newPane = createPane(pane.cwd, pane.shellType, undefined, pane.profileId)
              tabStore.splitTab(tab.id, newPane)
            } else {
              tabStore.ungroupTab(tab.id)
            }
            return
          }
          case 'commandPalette':
            uiStore.setCommandPaletteOpen(true)
            return
          case 'projectPalette':
            uiStore.setProjectPaletteOpen(true)
            return
          case 'settings':
            uiStore.toggleSettings()
            return
          case 'aiMode': {
            const tab = tabStore.getActiveTab()
            if (!tab) return
            const ref = tabStore.terminalRefs.get(tab.activePaneId)
            ref?.enterAIMode()
            return
          }
          case 'clearTerminal': {
            const tab = tabStore.getActiveTab()
            if (!tab) return
            const ref = tabStore.terminalRefs.get(tab.activePaneId)
            ref?.clear()
            return
          }
          case 'openVSCode': {
            const pane = tabStore.getActivePane()
            if (pane?.cwd) {
              void window.electronAPI.openInVSCode(pane.cwd)
            }
            return
          }
          case 'openCursor': {
            const pane = tabStore.getActivePane()
            if (pane?.cwd) {
              void window.electronAPI.openInCursor(pane.cwd)
            }
            return
          }
          case 'prevTabOrPane': {
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
          case 'nextTabOrPane': {
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
        }
      }

      // Primary-mod + 1..9 — switch to tab by index
      if (hasPrimaryModifier && !e.altKey && !e.shiftKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        tabStore.switchToTabByIndex(parseInt(e.key, 10) - 1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
