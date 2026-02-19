import { useEffect, useRef, useMemo } from 'react'
import { DndContext, DragOverlay, closestCenter, useDroppable } from '@dnd-kit/core'
import { PanelLeft, PanelRight } from 'lucide-react'
import TabBar, { TabOverlay } from './components/TabBar'
import Terminal from './components/Terminal'
import GitBar from './components/GitBar'
import { CommandPalette, ProjectPalette } from './components/Palette'
import EmptyState from './components/EmptyState'
import SettingsPane from './components/Settings'
import { Toaster } from './components/ui/sonner'
import { useTabStore, createPane } from './stores/useTabStore'
import { useSettingsStore } from './stores/useSettingsStore'
import { useUIStore } from './stores/useUIStore'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useSplitPane } from './hooks/useSplitPane'
import { useDragAndDrop } from './hooks/useDragAndDrop'
import {
  clampShellFontSize,
  SPLIT_PANE_DEFAULT_PCT,
  CWD_POLL_INTERVAL,
  CWD_POLL_STALE_MS,
  INITIAL_CWD_DELAY
} from '../../shared/constants'
import type { Pane, TabEntry, WindowSession } from '../../shared/ipc'
// Import to ensure global Window type declarations are loaded
import '../../shared/ipc'

// --- Drop zone for split-tab drag target ---
function SplitDropZone({ id, side }: { id: string; side: 'left' | 'right' }) {
  const { isOver, setNodeRef } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={`
        absolute top-0 bottom-0 z-30
        ${side === 'left' ? 'left-0 w-1/2' : 'right-0 w-1/2'}
        flex items-center justify-center
        transition-all duration-200 ease-out
        ${side === 'left' ? 'border-r' : 'border-l'}
        ${isOver
          ? 'bg-accent/15 border-accent/40'
          : 'bg-black/30 border-white/10'
        }
      `}
    >
      <div className={`
        flex flex-col items-center gap-3 px-8 py-5 rounded-2xl
        transition-all duration-200
        ${isOver
          ? 'bg-accent/90 text-white shadow-xl shadow-accent/25 scale-105'
          : 'bg-white/10 text-white/40 border border-white/10'
        }
      `}>
        <div className={`p-2.5 rounded-xl transition-colors duration-200 ${isOver ? 'bg-white/20' : 'bg-white/5'}`}>
          {side === 'left'
            ? <PanelLeft className="w-6 h-6" />
            : <PanelRight className="w-6 h-6" />
          }
        </div>
        <span className="text-sm font-semibold tracking-wide">
          {side === 'left' ? 'Open Left' : 'Open Right'}
        </span>
      </div>
    </div>
  )
}

export default function App() {
  // Stores
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const splitSizes = useTabStore((s) => s.splitSizes)
  const initialContentMap = useTabStore((s) => s.initialContentMap)

  const settings = useSettingsStore((s) => s.settings)
  const settingsLoaded = useSettingsStore((s) => s.settingsLoaded)

  const settingsOpen = useUIStore((s) => s.settingsOpen)
  const sessionLoaded = useUIStore((s) => s.sessionLoaded)
  const activeDragId = useUIStore((s) => s.activeDragId)
  const commandPaletteOpen = useUIStore((s) => s.commandPaletteOpen)
  const projectPaletteOpen = useUIStore((s) => s.projectPaletteOpen)
  const cachedRepos = useSettingsStore((s) => s.cachedRepos)
  const reposLoading = useSettingsStore((s) => s.reposLoading)

  // Hooks
  useKeyboardShortcuts()
  const { terminalAreaRef, startResize } = useSplitPane()
  const { sensors, handleDragStart, handleDragEnd, handleDragCancel } = useDragAndDrop()

  // Derived
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null
  const activePane = activeTab
    ? activeTab.panes.find((p) => p.id === activeTab.activePaneId) || activeTab.panes[0] || null
    : null
  const modalOpen = commandPaletteOpen || projectPaletteOpen || settingsOpen
  const getProfile = useSettingsStore.getState().getProfile
  const paneCwdUpdatedAtRef = useRef<Record<string, number>>({})
  const cwdPollingInFlightRef = useRef<Set<string>>(new Set())

  // Stable style refs to avoid re-creating objects every render (split pane layout)
  const singlePaneStyle = useMemo<React.CSSProperties>(
    () => ({ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }),
    []
  )
  const splitPaneStylesByTab = useMemo(() => {
    const map: Record<string, [React.CSSProperties, React.CSSProperties]> = {}
    for (const tab of tabs) {
      if (tab.type === 'split') {
        const sw = splitSizes[tab.id] ?? SPLIT_PANE_DEFAULT_PCT
        map[tab.id] = [
          { position: 'absolute', top: 0, bottom: 0, left: 0, width: `${sw}%` },
          { position: 'absolute', top: 0, bottom: 0, left: `${sw}%`, width: `${100 - sw}%` }
        ]
      }
    }
    return map
  }, [tabs, splitSizes])

  // --- Mount effects ---

  // 1. Load settings
  useEffect(() => {
    useSettingsStore.getState().loadSettings()
  }, [])

  // 2. After settings loaded, restore session
  useEffect(() => {
    if (!settingsLoaded) return
    window.electronAPI.loadSession().then((session: WindowSession | null) => {
      if (session && session.tabs.length > 0) {
        const { profiles, defaultProfileId } = useSettingsStore.getState().settings
        useTabStore.getState().restoreSession(session, profiles, defaultProfileId)
      }
      useUIStore.getState().setSessionLoaded(true)
    }).catch(() => {
      useUIStore.getState().setSessionLoaded(true)
    })
  }, [settingsLoaded])

  // 3. Listen for CWD changes via onPtyCwd
  useEffect(() => {
    const unsubscribe = window.electronAPI.onPtyCwd((event) => {
      useTabStore.getState().updatePaneCwd(event.tabId, event.cwd)
      paneCwdUpdatedAtRef.current[event.tabId] = Date.now()
    })
    return unsubscribe
  }, [])

  // 4. Listen for session save requests
  useEffect(() => {
    const unsubscribe = window.electronAPI.onSessionRequestSave(() => {
      const { tabs: savedTabs, activeTabIndex } = useTabStore.getState().serializeForSave()
      const windowSession: WindowSession = {
        bounds: { x: 0, y: 0, width: 0, height: 0 },
        tabs: savedTabs,
        activeTabIndex
      }
      window.electronAPI.saveWindowSession(windowSession)
    })
    return unsubscribe
  }, [])

  // 5. Listen for menu events from main process
  useEffect(() => {
    const unsubNewTab = window.electronAPI.onMenuNewTab(() => {
      handleNewTab()
    })
    const unsubCloseTab = window.electronAPI.onMenuCloseTab(() => {
      const tabStore = useTabStore.getState()
      const tab = tabStore.getActiveTab()
      if (!tab) return
      if (tab.type === 'split') {
        tabStore.closePane(tab.id, tab.activePaneId)
      } else {
        tabStore.closeTabEntry(tab.id)
      }
    })
    const unsubOpenSettings = window.electronAPI.onMenuOpenSettings(() => {
      useUIStore.getState().setSettingsOpen(true)
    })
    return () => {
      unsubNewTab()
      unsubCloseTab()
      unsubOpenSettings()
    }
  }, [])

  // 6. Slow CWD polling fallback (only active tab's panes to reduce IPC/main work)
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      if (document.hidden) return

      const { tabs: currentTabs, activeTabId: currentActiveId } = useTabStore.getState()
      const activeTab = currentTabs.find((t) => t.id === currentActiveId)
      if (!activeTab) return

      const now = Date.now()
      for (const pane of activeTab.panes) {
        const lastUpdate = paneCwdUpdatedAtRef.current[pane.id] ?? 0
        if (lastUpdate > 0 && now - lastUpdate < CWD_POLL_STALE_MS) {
          continue
        }
        if (cwdPollingInFlightRef.current.has(pane.id)) {
          continue
        }

        cwdPollingInFlightRef.current.add(pane.id)
        try {
          const cwd = await window.electronAPI.getCwd(pane.id)
          if (cwd && cwd !== pane.cwd) {
            useTabStore.getState().updatePaneCwd(pane.id, cwd)
          }
          if (cwd) {
            paneCwdUpdatedAtRef.current[pane.id] = Date.now()
          }
        } catch {
          // Ignore errors
        } finally {
          cwdPollingInFlightRef.current.delete(pane.id)
        }
      }
    }, CWD_POLL_INTERVAL)

    return () => clearInterval(pollInterval)
  }, [])

  // 7. Fetch git repos
  useEffect(() => {
    if (!settingsLoaded) return
    useSettingsStore.getState().fetchRepos()
  }, [settingsLoaded, settings.defaultProfileId])

  // 8. Save settings on change (debounced 500ms to avoid IPC flood while typing)
  const saveSettingsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!settingsLoaded) return
    if (saveSettingsTimeoutRef.current) clearTimeout(saveSettingsTimeoutRef.current)
    saveSettingsTimeoutRef.current = setTimeout(() => {
      saveSettingsTimeoutRef.current = null
      window.electronAPI.saveSettings(settings)
    }, 500)
    return () => {
      if (saveSettingsTimeoutRef.current) {
        clearTimeout(saveSettingsTimeoutRef.current)
        saveSettingsTimeoutRef.current = null
      }
    }
  }, [settings, settingsLoaded])

  // 9. Update window title based on active pane CWD
  useEffect(() => {
    const cwd = activePane?.cwd
    if (!cwd) {
      window.electronAPI.setWindowTitle('Frostty')
      return
    }
    // Extract directory basename for a concise title
    const parts = cwd.replace(/\/$/, '').split('/')
    const dirname = parts[parts.length - 1] || cwd
    window.electronAPI.setWindowTitle(`${dirname} — Frostty`)
  }, [activePane?.cwd])

  // --- Event handlers for TabBar ---
  const handleTabClick = (tabId: string) => {
    useTabStore.getState().switchTab(tabId)
    useUIStore.getState().setSettingsOpen(false)
  }

  const handleNewTab = (profileId?: string, initialPath?: string) => {
    const profile = useSettingsStore.getState().getProfile(profileId)
    const cwd = initialPath || profile.homeDirectory
    const pane = createPane(cwd, profile.shell, undefined, profile.id)
    useTabStore.getState().addTab(pane)
    useUIStore.getState().setSettingsOpen(false)

    // Get initial CWD after a short delay (fallback if OSC 7 not available)
    setTimeout(async () => {
      try {
        const actualCwd = await window.electronAPI.getCwd(pane.id)
        if (actualCwd) {
          useTabStore.getState().updatePaneCwd(pane.id, actualCwd)
          paneCwdUpdatedAtRef.current[pane.id] = Date.now()
        }
      } catch {
        // Ignore errors
      }
    }, INITIAL_CWD_DELAY)
  }

  const handlePaneClick = (tabId: string, paneId: string) => {
    handleTabClick(tabId)
    useTabStore.getState().setActivePaneInTab(tabId, paneId)
  }

  // --- Terminal renderer ---
  const renderTerminal = (tab: TabEntry, pane: Pane, isPaneActive: boolean) => {
    const profile = getProfile(pane.profileId)

    return (
      <Terminal
        key={pane.id}
        tabId={pane.id}
        isActive={tab.id === activeTabId && isPaneActive}
        fontSize={clampShellFontSize(profile.shellFontSize)}
        modalOpen={modalOpen}
        initialCwd={pane.cwd}
        initialContent={initialContentMap.get(pane.id)}
        shell={pane.shellType ?? profile.shell}
        onShellReady={(shell) => {
          useTabStore.getState().updatePaneShell(pane.id, shell)
        }}
        onFocus={() => {
          if (tab.type === 'split') {
            useTabStore.getState().setActivePaneInTab(tab.id, pane.id)
          }
        }}
        openRouterApiKey={settings.openRouterApiKey}
        openRouterModel={settings.openRouterModel}
        currentCwd={pane.cwd}
      />
    )
  }

  // --- Drag-related computed values ---
  const draggedTab = activeDragId ? tabs.find((t) => t.id === activeDragId) : null
  const activeDragIndex = activeDragId ? tabs.findIndex((t) => t.id === activeDragId) : -1
  const showDropZones = !!(
    activeDragId &&
    activeTab &&
    draggedTab &&
    activeTab.id !== activeDragId &&
    activeTab.type === 'single' &&
    draggedTab.type === 'single'
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex h-screen w-screen overflow-hidden bg-primary">
        {/* Vertical Tab Bar */}
        <TabBar
          onTabClick={handleTabClick}
          onTabClose={(id) => useTabStore.getState().closeTabEntry(id)}
          onNewTab={handleNewTab}
          onPaneClick={handlePaneClick}
          onPaneClose={(tabId, paneId) => useTabStore.getState().closePane(tabId, paneId)}
          onUngroupTab={(id) => useTabStore.getState().ungroupTab(id)}
          onSettingsClick={() => useUIStore.getState().toggleSettings()}
        />

        {/* Main Content Area */}
        <div className="flex-1 h-full flex flex-col min-w-0">
          {/* Settings Pane */}
          {settingsOpen && (
            <SettingsPane
              settings={settings}
              onSave={useSettingsStore.getState().setSettings}
              onClose={() => useUIStore.getState().setSettingsOpen(false)}
            />
          )}

          {/* Terminal area (hidden when settings is open) */}
          <div className={`flex-1 flex flex-col ${settingsOpen ? 'hidden' : ''}`}>
            <GitBar cwd={activePane?.cwd || '~'} />

            <div className="flex-1 relative" ref={terminalAreaRef}>
              {tabs.flatMap((tab) => {
                const isTabActive = tab.id === activeTabId

                return tab.panes.map((pane, paneIndex) => {
                  const isPaneActive = tab.type === 'single' || tab.activePaneId === pane.id
                  const style =
                    tab.type === 'split'
                      ? splitPaneStylesByTab[tab.id]?.[paneIndex] ?? singlePaneStyle
                      : singlePaneStyle

                  return (
                    <div key={pane.id} className={isTabActive ? '' : 'hidden'} style={style}>
                      {renderTerminal(tab, pane, isPaneActive)}
                    </div>
                  )
                })
              })}

              {/* Resize handles for split tabs */}
              {tabs.map((tab) => {
                if (tab.type !== 'split' || tab.id !== activeTabId) return null
                const splitWidth = splitSizes[tab.id] ?? SPLIT_PANE_DEFAULT_PCT
                return (
                  <div
                    key={`handle-${tab.id}`}
                    className="absolute top-0 bottom-0 z-10 group cursor-col-resize"
                    style={{ left: `${splitWidth}%`, width: '9px', transform: 'translateX(-50%)' }}
                    onMouseDown={(e) => startResize(e, tab.id)}
                  >
                    <div className="w-px h-full mx-auto bg-white/5 group-hover:bg-accent/30 transition-colors" />
                  </div>
                )
              })}

              {/* Split drop zones */}
              {showDropZones && (
                <>
                  <SplitDropZone id="drop-left" side="left" />
                  <SplitDropZone id="drop-right" side="right" />
                </>
              )}

              {/* Empty state */}
              {tabs.length === 0 && sessionLoaded && <EmptyState />}
            </div>
          </div>
        </div>

        {/* Command Palette */}
        <CommandPalette
          open={commandPaletteOpen}
          onOpenChange={useUIStore.getState().setCommandPaletteOpen}
          onNewTab={handleNewTab}
          onCloseTab={() => {
            const id = useTabStore.getState().activeTabId
            if (id) useTabStore.getState().closeTabEntry(id)
          }}
          onClearTab={() => {
            const tabStore = useTabStore.getState()
            const tab = tabStore.getActiveTab()
            if (tab) {
              const ref = tabStore.terminalRefs.get(tab.activePaneId)
              ref?.clear()
            }
          }}
          onCloseAllTabs={() => useTabStore.getState().closeAllTabs()}
          onRestoreClosedTab={() => useTabStore.getState().restoreClosedTab()}
          onOpenSettings={() => useUIStore.getState().setSettingsOpen(true)}
          onOpenProjectPalette={() => useUIStore.getState().setProjectPaletteOpen(true)}
          activeCwd={activePane?.cwd || null}
          profiles={settings.profiles}
        />

        {/* Project Palette */}
        <ProjectPalette
          open={projectPaletteOpen}
          onOpenChange={useUIStore.getState().setProjectPaletteOpen}
          onSelectProject={(projectPath) => handleNewTab(undefined, projectPath)}
          repos={cachedRepos}
          loading={reposLoading}
        />

        {/* Toast notifications */}
        <Toaster position="top-center" />
      </div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {draggedTab ? <TabOverlay tab={draggedTab} index={activeDragIndex} profiles={settings.profiles} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
