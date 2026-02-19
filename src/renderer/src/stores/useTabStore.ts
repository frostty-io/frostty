import { create } from 'zustand'
import type { TabEntry, Pane, ShellType, Profile, SavedTab, SavedPane, WindowSession } from '../../../shared/ipc'

// ---------------------------------------------------------------------------
// ID generators
// ---------------------------------------------------------------------------

let tabCounter = 0
let paneCounter = 0

function generateTabId(): string {
  return `tab-${++tabCounter}-${Date.now()}`
}

function generatePaneId(): string {
  return `pane-${++paneCounter}-${Date.now()}`
}

export function createPane(cwd: string, shellType?: ShellType, title?: string, profileId?: string): Pane {
  return {
    id: generatePaneId(),
    title: title || 'shell',
    shell: 'shell',
    cwd,
    shellType,
    profileId
  }
}

// ---------------------------------------------------------------------------
// Closed tab info (for restore)
// ---------------------------------------------------------------------------

export interface ClosedTabInfo {
  panes: {
    cwd: string
    shellType?: ShellType
    profileId?: string
    title: string
    scrollback?: string
  }[]
  type: 'single' | 'split'
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface TabState {
  tabs: TabEntry[]
  activeTabId: string | null
  closedTabs: ClosedTabInfo[]
  splitSizes: Record<string, number>

  // Terminal refs - keyed by pane ID
  terminalRefs: Map<string, { enterAIMode: () => void; serialize: () => string; clear: () => void }>
  // Map of paneId -> scrollback content for restored tabs
  initialContentMap: Map<string, string>

  // Derived helpers
  getActiveTab: () => TabEntry | null
  getActivePane: () => Pane | null
  getAllPaneIds: () => string[]

  // Tab CRUD
  addTab: (pane: Pane) => string
  closeTabEntry: (tabEntryId: string) => void
  closePane: (tabEntryId: string, paneId: string) => void
  closeAllTabs: () => void
  restoreClosedTab: () => void
  switchTab: (tabId: string) => void
  nextTab: () => void
  prevTab: () => void
  switchToTabByIndex: (index: number) => void
  setActivePaneInTab: (tabEntryId: string, paneId: string) => void
  reorderTabs: (fromIndex: number, toIndex: number) => void

  // Tab modifications
  splitTab: (tabEntryId: string, newPane: Pane) => void
  ungroupTab: (tabEntryId: string) => void
  splitDropTab: (sourceTabId: string, position: 'left' | 'right') => void
  updatePaneCwd: (paneId: string, cwd: string) => void
  updatePaneShell: (paneId: string, shell: string) => void
  setSplitSize: (tabId: string, size: number) => void

  // Terminal ref management
  setTerminalRef: (paneId: string, ref: { enterAIMode: () => void; serialize: () => string; clear: () => void } | null) => void

  // Session
  restoreSession: (session: WindowSession, profiles: Profile[], defaultProfileId: string) => void
  serializeForSave: () => { tabs: SavedTab[]; activeTabIndex: number }
}

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  closedTabs: [],
  splitSizes: {},
  terminalRefs: new Map(),
  initialContentMap: new Map(),

  // Derived helpers
  getActiveTab: () => {
    const { tabs, activeTabId } = get()
    if (!activeTabId) return null
    return tabs.find((t) => t.id === activeTabId) || null
  },

  getActivePane: () => {
    const tab = get().getActiveTab()
    if (!tab) return null
    return tab.panes.find((p) => p.id === tab.activePaneId) || tab.panes[0] || null
  },

  getAllPaneIds: () => {
    return get().tabs.flatMap((t) => t.panes.map((p) => p.id))
  },

  // Tab CRUD
  addTab: (pane) => {
    const tabId = generateTabId()
    const newTab: TabEntry = {
      id: tabId,
      type: 'single',
      panes: [pane],
      activePaneId: pane.id
    }
    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: tabId
    }))
    return tabId
  },

  closeTabEntry: (tabEntryId) => {
    const { tabs, terminalRefs } = get()
    const tab = tabs.find((t) => t.id === tabEntryId)
    if (!tab) return

    // Save tab info for restore
    const closedEntry: ClosedTabInfo = {
      panes: tab.panes.map((p) => {
        const handle = terminalRefs.get(p.id)
        const scrollback = handle ? handle.serialize() : undefined
        return {
          cwd: p.cwd,
          shellType: p.shellType,
          profileId: p.profileId,
          title: p.title,
          scrollback: scrollback || undefined
        }
      }),
      type: tab.type
    }

    // Kill all PTYs for this tab
    tab.panes.forEach((pane) => {
      window.electronAPI.killPty(pane.id)
      if (window.__frostty_cleanup_pty) {
        window.__frostty_cleanup_pty(pane.id)
      }
    })

    set((state) => {
      const newTabs = state.tabs.filter((t) => t.id !== tabEntryId)
      let newActiveId = state.activeTabId

      if (newActiveId === tabEntryId) {
        const closedIndex = state.tabs.findIndex((t) => t.id === tabEntryId)
        if (newTabs.length === 0) {
          newActiveId = null
        } else {
          const newIndex = Math.min(closedIndex, newTabs.length - 1)
          newActiveId = newTabs[newIndex].id
        }
      }

      return {
        tabs: newTabs,
        activeTabId: newActiveId,
        closedTabs: [...state.closedTabs, closedEntry]
      }
    })
  },

  closePane: (tabEntryId, paneId) => {
    const { tabs, terminalRefs } = get()
    const tab = tabs.find((t) => t.id === tabEntryId)
    const pane = tab?.panes.find((p) => p.id === paneId)

    if (pane) {
      const handle = terminalRefs.get(paneId)
      const scrollback = handle ? handle.serialize() : undefined
      set((state) => ({
        closedTabs: [
          ...state.closedTabs,
          {
            panes: [
              {
                cwd: pane.cwd,
                shellType: pane.shellType,
                profileId: pane.profileId,
                title: pane.title,
                scrollback: scrollback || undefined
              }
            ],
            type: 'single' as const
          }
        ]
      }))
    }

    // Kill PTY
    window.electronAPI.killPty(paneId)
    if (window.__frostty_cleanup_pty) {
      window.__frostty_cleanup_pty(paneId)
    }

    set((state) => {
      const tab = state.tabs.find((t) => t.id === tabEntryId)
      if (!tab) return state

      const remainingPanes = tab.panes.filter((p) => p.id !== paneId)

      if (remainingPanes.length === 0) {
        // Remove entire tab
        const newTabs = state.tabs.filter((t) => t.id !== tabEntryId)
        let newActiveId = state.activeTabId
        if (newActiveId === tabEntryId) {
          const closedIndex = state.tabs.findIndex((t) => t.id === tabEntryId)
          if (newTabs.length === 0) {
            newActiveId = null
          } else {
            const newIndex = Math.min(closedIndex, newTabs.length - 1)
            newActiveId = newTabs[newIndex].id
          }
        }
        return { tabs: newTabs, activeTabId: newActiveId }
      }

      // Update tab with remaining panes
      return {
        tabs: state.tabs.map((t) => {
          if (t.id !== tabEntryId) return t
          return {
            ...t,
            type: (remainingPanes.length === 1 ? 'single' : 'split') as 'single' | 'split',
            panes: remainingPanes,
            activePaneId: remainingPanes[0].id
          }
        })
      }
    })
  },

  closeAllTabs: () => {
    const { tabs, terminalRefs } = get()

    // Save all tabs for restore
    const closedEntries: ClosedTabInfo[] = tabs.map((tab) => ({
      panes: tab.panes.map((p) => {
        const handle = terminalRefs.get(p.id)
        const scrollback = handle ? handle.serialize() : undefined
        return {
          cwd: p.cwd,
          shellType: p.shellType,
          profileId: p.profileId,
          title: p.title,
          scrollback: scrollback || undefined
        }
      }),
      type: tab.type
    }))

    // Kill all PTYs
    tabs.forEach((tab) => {
      tab.panes.forEach((pane) => {
        window.electronAPI.killPty(pane.id)
        if (window.__frostty_cleanup_pty) {
          window.__frostty_cleanup_pty(pane.id)
        }
      })
    })

    set((state) => ({
      tabs: [],
      activeTabId: null,
      closedTabs: [...state.closedTabs, ...closedEntries]
    }))
  },

  restoreClosedTab: () => {
    const { closedTabs, initialContentMap } = get()
    if (closedTabs.length === 0) return

    const entry = closedTabs[closedTabs.length - 1]
    const tabId = generateTabId()
    const panes: Pane[] = entry.panes.map((p) => {
      const pane = createPane(p.cwd, p.shellType, p.title, p.profileId)
      if (p.scrollback) {
        initialContentMap.set(pane.id, p.scrollback)
      }
      return pane
    })

    const newTab: TabEntry = {
      id: tabId,
      type: entry.type,
      panes,
      activePaneId: panes[0].id
    }

    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: tabId,
      closedTabs: state.closedTabs.slice(0, -1)
    }))
  },

  switchTab: (tabId) => {
    set({ activeTabId: tabId })
  },

  nextTab: () => {
    set((state) => {
      if (!state.activeTabId || state.tabs.length === 0) return state
      const currentIndex = state.tabs.findIndex((t) => t.id === state.activeTabId)
      const nextIndex = (currentIndex + 1) % state.tabs.length
      return { activeTabId: state.tabs[nextIndex].id }
    })
  },

  prevTab: () => {
    set((state) => {
      if (!state.activeTabId || state.tabs.length === 0) return state
      const currentIndex = state.tabs.findIndex((t) => t.id === state.activeTabId)
      const prevIndex = (currentIndex - 1 + state.tabs.length) % state.tabs.length
      return { activeTabId: state.tabs[prevIndex].id }
    })
  },

  switchToTabByIndex: (index) => {
    set((state) => {
      if (index >= 0 && index < state.tabs.length) {
        return { activeTabId: state.tabs[index].id }
      }
      return state
    })
  },

  setActivePaneInTab: (tabEntryId, paneId) => {
    set((state) => ({
      tabs: state.tabs.map((t) => {
        if (t.id !== tabEntryId) return t
        return { ...t, activePaneId: paneId }
      })
    }))
  },

  reorderTabs: (fromIndex, toIndex) => {
    set((state) => {
      const newTabs = [...state.tabs]
      const [moved] = newTabs.splice(fromIndex, 1)
      newTabs.splice(toIndex, 0, moved)
      return { tabs: newTabs }
    })
  },

  // Tab modifications
  splitTab: (tabEntryId, newPane) => {
    set((state) => {
      const tab = state.tabs.find((t) => t.id === tabEntryId)
      if (!tab || tab.type === 'split') return state

      return {
        tabs: state.tabs.map((t) => {
          if (t.id !== tabEntryId) return t
          return {
            ...t,
            type: 'split' as const,
            panes: [...t.panes, newPane],
            activePaneId: newPane.id
          }
        })
      }
    })
  },

  ungroupTab: (tabEntryId) => {
    const { tabs, activeTabId } = get()
    const tab = tabs.find((t) => t.id === tabEntryId)
    if (!tab || tab.type !== 'split') return

    const tabIndex = tabs.findIndex((t) => t.id === tabEntryId)
    let activeNewTabId: string | null = null
    const newTabs: TabEntry[] = tab.panes.map((pane) => {
      const newId = generateTabId()
      if (pane.id === tab.activePaneId) {
        activeNewTabId = newId
      }
      return {
        id: newId,
        type: 'single' as const,
        panes: [pane],
        activePaneId: pane.id
      }
    })

    set((state) => {
      const result = [...state.tabs]
      result.splice(tabIndex, 1, ...newTabs)
      return {
        tabs: result,
        activeTabId: activeTabId === tabEntryId && activeNewTabId ? activeNewTabId : state.activeTabId
      }
    })
  },

  splitDropTab: (sourceTabId, position) => {
    const { activeTabId, tabs } = get()
    if (!activeTabId || sourceTabId === activeTabId) return

    const sourceTab = tabs.find((t) => t.id === sourceTabId)
    const targetTab = tabs.find((t) => t.id === activeTabId)
    if (!sourceTab || !targetTab) return
    if (sourceTab.type !== 'single' || targetTab.type !== 'single') return

    const sourcePane = sourceTab.panes[0]
    if (!sourcePane) return

    const newPanes = position === 'left' ? [sourcePane, ...targetTab.panes] : [...targetTab.panes, sourcePane]

    set((state) => ({
      tabs: state.tabs
        .filter((t) => t.id !== sourceTabId)
        .map((t) => {
          if (t.id !== activeTabId) return t
          return {
            ...t,
            type: 'split' as const,
            panes: newPanes,
            activePaneId: sourcePane.id
          }
        })
    }))
  },

  updatePaneCwd: (paneId, cwd) => {
    set((state) => {
      for (let ti = 0; ti < state.tabs.length; ti++) {
        const tab = state.tabs[ti]
        const pi = tab.panes.findIndex((p) => p.id === paneId)
        if (pi === -1) continue
        const pane = tab.panes[pi]
        if (pane.cwd === cwd) return state
        const newPanes = [...tab.panes]
        newPanes[pi] = { ...pane, cwd }
        const newTabs = [...state.tabs]
        newTabs[ti] = { ...tab, panes: newPanes }
        return { tabs: newTabs }
      }
      return state
    })
  },

  updatePaneShell: (paneId, shell) => {
    set((state) => {
      for (let ti = 0; ti < state.tabs.length; ti++) {
        const tab = state.tabs[ti]
        const pi = tab.panes.findIndex((p) => p.id === paneId)
        if (pi === -1) continue
        const pane = tab.panes[pi]
        if (pane.shell === shell) return state
        const newPanes = [...tab.panes]
        newPanes[pi] = { ...pane, shell }
        const newTabs = [...state.tabs]
        newTabs[ti] = { ...tab, panes: newPanes }
        return { tabs: newTabs }
      }
      return state
    })
  },

  setSplitSize: (tabId, size) => {
    set((state) => ({
      splitSizes: { ...state.splitSizes, [tabId]: size }
    }))
  },

  setTerminalRef: (paneId, ref) => {
    set((state) => {
      const currentRef = state.terminalRefs.get(paneId) ?? null
      if (currentRef === ref) return state
      const newRefs = new Map(state.terminalRefs)
      if (ref) {
        newRefs.set(paneId, ref)
      } else {
        newRefs.delete(paneId)
      }
      return { terminalRefs: newRefs }
    })
  },

  // Session
  restoreSession: (session, profiles, defaultProfileId) => {
    const { initialContentMap } = get()
    if (!session || session.tabs.length === 0) return

    const restoredTabs: TabEntry[] = []
    let activeIdx = session.activeTabIndex

    for (let i = 0; i < session.tabs.length; i++) {
      const savedTab = session.tabs[i]

      if (savedTab.panes && savedTab.panes.length > 0) {
        const tabId = generateTabId()
        const panes: Pane[] = savedTab.panes.map((sp, pi) => {
          const fallbackProfile = profiles.find((p) => p.id === sp.profileId) || profiles[0]
          const pane = createPane(sp.cwd || fallbackProfile.homeDirectory, sp.shellType, sp.title || `Pane ${pi + 1}`, sp.profileId)
          if (sp.scrollback) {
            initialContentMap.set(pane.id, sp.scrollback)
          }
          return pane
        })
        const activePaneIdx = savedTab.activePaneIndex ?? 0
        restoredTabs.push({
          id: tabId,
          type: savedTab.type === 'split' ? 'split' : 'single',
          panes,
          activePaneId: panes[Math.min(activePaneIdx, panes.length - 1)].id
        })
      } else {
        // Legacy single-pane format
        const tabId = generateTabId()
        const defaultProfile = profiles.find((p) => p.id === defaultProfileId) || profiles[0]
        const pane = createPane(
          savedTab.cwd || defaultProfile.homeDirectory,
          savedTab.shellType,
          savedTab.title || `Tab ${i + 1}`,
          defaultProfile.id
        )
        if (savedTab.scrollback) {
          initialContentMap.set(pane.id, savedTab.scrollback)
        }
        restoredTabs.push({
          id: tabId,
          type: 'single',
          panes: [pane],
          activePaneId: pane.id
        })
      }
    }

    if (activeIdx < 0 || activeIdx >= restoredTabs.length) {
      activeIdx = 0
    }

    set({
      tabs: restoredTabs,
      activeTabId: restoredTabs[activeIdx].id
    })
  },

  serializeForSave: () => {
    const { tabs, activeTabId, terminalRefs } = get()

    const savedTabs: SavedTab[] = tabs.map((tab) => {
      const savedPanes: SavedPane[] = tab.panes.map((pane) => {
        const handle = terminalRefs.get(pane.id)
        const scrollback = handle ? handle.serialize() : undefined
        return {
          title: pane.title,
          cwd: pane.cwd,
          shellType: pane.shellType,
          scrollback: scrollback || undefined,
          profileId: pane.profileId
        }
      })
      const activePaneIndex = tab.panes.findIndex((p) => p.id === tab.activePaneId)
      return {
        type: tab.type,
        panes: savedPanes,
        activePaneIndex: activePaneIndex >= 0 ? activePaneIndex : 0
      }
    })

    const activeIdx = tabs.findIndex((t) => t.id === activeTabId)

    return {
      tabs: savedTabs,
      activeTabIndex: activeIdx >= 0 ? activeIdx : 0
    }
  }
}))
