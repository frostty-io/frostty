import { describe, it, expect, beforeEach } from 'vitest'
import { useTabStore, createPane } from '../../stores/useTabStore'

describe('useTabStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useTabStore.setState({
      tabs: [],
      activeTabId: null,
      closedTabs: [],
      splitSizes: {},
      terminalRefs: new Map(),
      initialContentMap: new Map()
    })
  })

  describe('createPane', () => {
    it('creates a pane with default values', () => {
      const pane = createPane('~/projects')
      expect(pane.id).toMatch(/^pane-/)
      expect(pane.cwd).toBe('~/projects')
      expect(pane.title).toBe('shell')
      expect(pane.shell).toBe('shell')
    })

    it('creates a pane with custom values', () => {
      const pane = createPane('/home', 'zsh', 'My Shell', 'profile-1')
      expect(pane.cwd).toBe('/home')
      expect(pane.shellType).toBe('zsh')
      expect(pane.title).toBe('My Shell')
      expect(pane.profileId).toBe('profile-1')
    })
  })

  describe('addTab', () => {
    it('adds a tab and sets it as active', () => {
      const pane = createPane('~')
      const tabId = useTabStore.getState().addTab(pane)

      const state = useTabStore.getState()
      expect(state.tabs).toHaveLength(1)
      expect(state.tabs[0].id).toBe(tabId)
      expect(state.tabs[0].type).toBe('single')
      expect(state.tabs[0].panes).toEqual([pane])
      expect(state.activeTabId).toBe(tabId)
    })

    it('adds multiple tabs', () => {
      const pane1 = createPane('~/a')
      const pane2 = createPane('~/b')

      useTabStore.getState().addTab(pane1)
      useTabStore.getState().addTab(pane2)

      const state = useTabStore.getState()
      expect(state.tabs).toHaveLength(2)
      // Second tab should be active
      expect(state.activeTabId).toBe(state.tabs[1].id)
    })
  })

  describe('getActiveTab', () => {
    it('returns null when no tabs', () => {
      expect(useTabStore.getState().getActiveTab()).toBeNull()
    })

    it('returns the active tab', () => {
      const pane = createPane('~')
      const tabId = useTabStore.getState().addTab(pane)
      const activeTab = useTabStore.getState().getActiveTab()
      expect(activeTab?.id).toBe(tabId)
    })
  })

  describe('getActivePane', () => {
    it('returns null when no tabs', () => {
      expect(useTabStore.getState().getActivePane()).toBeNull()
    })

    it('returns the active pane', () => {
      const pane = createPane('~/test')
      useTabStore.getState().addTab(pane)
      const activePane = useTabStore.getState().getActivePane()
      expect(activePane?.cwd).toBe('~/test')
    })
  })

  describe('closeTabEntry', () => {
    it('closes a tab and adds it to closedTabs', () => {
      const pane = createPane('~')
      const tabId = useTabStore.getState().addTab(pane)
      useTabStore.getState().closeTabEntry(tabId)

      const state = useTabStore.getState()
      expect(state.tabs).toHaveLength(0)
      expect(state.activeTabId).toBeNull()
      expect(state.closedTabs).toHaveLength(1)
      expect(state.closedTabs[0].panes[0].cwd).toBe('~')
    })

    it('activates adjacent tab when closing active tab', () => {
      const pane1 = createPane('~/a')
      const pane2 = createPane('~/b')
      const pane3 = createPane('~/c')

      useTabStore.getState().addTab(pane1)
      const tabId2 = useTabStore.getState().addTab(pane2)
      useTabStore.getState().addTab(pane3)

      // Switch to middle tab
      useTabStore.getState().switchTab(tabId2)
      useTabStore.getState().closeTabEntry(tabId2)

      const state = useTabStore.getState()
      expect(state.tabs).toHaveLength(2)
      // Should activate a remaining tab
      expect(state.activeTabId).not.toBeNull()
    })
  })

  describe('switchTab', () => {
    it('switches active tab', () => {
      const pane1 = createPane('~/a')
      const pane2 = createPane('~/b')

      const tabId1 = useTabStore.getState().addTab(pane1)
      useTabStore.getState().addTab(pane2)

      useTabStore.getState().switchTab(tabId1)
      expect(useTabStore.getState().activeTabId).toBe(tabId1)
    })
  })

  describe('nextTab / prevTab', () => {
    it('cycles through tabs', () => {
      const pane1 = createPane('~/a')
      const pane2 = createPane('~/b')
      const pane3 = createPane('~/c')

      const tabId1 = useTabStore.getState().addTab(pane1)
      const tabId2 = useTabStore.getState().addTab(pane2)
      const tabId3 = useTabStore.getState().addTab(pane3)

      // Currently on tab 3
      useTabStore.getState().switchTab(tabId1)
      useTabStore.getState().nextTab()
      expect(useTabStore.getState().activeTabId).toBe(tabId2)

      useTabStore.getState().nextTab()
      expect(useTabStore.getState().activeTabId).toBe(tabId3)

      // Wrap around
      useTabStore.getState().nextTab()
      expect(useTabStore.getState().activeTabId).toBe(tabId1)

      // Go backwards
      useTabStore.getState().prevTab()
      expect(useTabStore.getState().activeTabId).toBe(tabId3)
    })
  })

  describe('switchToTabByIndex', () => {
    it('switches to tab by index', () => {
      const pane1 = createPane('~/a')
      const pane2 = createPane('~/b')

      const tabId1 = useTabStore.getState().addTab(pane1)
      useTabStore.getState().addTab(pane2)

      useTabStore.getState().switchToTabByIndex(0)
      expect(useTabStore.getState().activeTabId).toBe(tabId1)
    })

    it('ignores out of range index', () => {
      const pane = createPane('~')
      const tabId = useTabStore.getState().addTab(pane)

      useTabStore.getState().switchToTabByIndex(5)
      expect(useTabStore.getState().activeTabId).toBe(tabId)
    })
  })

  describe('reorderTabs', () => {
    it('reorders tabs', () => {
      const pane1 = createPane('~/a')
      const pane2 = createPane('~/b')
      const pane3 = createPane('~/c')

      useTabStore.getState().addTab(pane1)
      useTabStore.getState().addTab(pane2)
      useTabStore.getState().addTab(pane3)

      const originalOrder = useTabStore.getState().tabs.map((t) => t.panes[0].cwd)
      expect(originalOrder).toEqual(['~/a', '~/b', '~/c'])

      useTabStore.getState().reorderTabs(0, 2)
      const newOrder = useTabStore.getState().tabs.map((t) => t.panes[0].cwd)
      expect(newOrder).toEqual(['~/b', '~/c', '~/a'])
    })
  })

  describe('splitTab', () => {
    it('splits a single tab into split', () => {
      const pane1 = createPane('~')
      const tabId = useTabStore.getState().addTab(pane1)

      const newPane = createPane('~/other')
      useTabStore.getState().splitTab(tabId, newPane)

      const tab = useTabStore.getState().tabs[0]
      expect(tab.type).toBe('split')
      expect(tab.panes).toHaveLength(2)
      expect(tab.activePaneId).toBe(newPane.id)
    })

    it('does not split an already split tab', () => {
      const pane1 = createPane('~')
      const tabId = useTabStore.getState().addTab(pane1)

      const newPane1 = createPane('~/other1')
      useTabStore.getState().splitTab(tabId, newPane1)

      const newPane2 = createPane('~/other2')
      useTabStore.getState().splitTab(tabId, newPane2)

      // Should still have 2 panes
      const tab = useTabStore.getState().tabs[0]
      expect(tab.panes).toHaveLength(2)
    })
  })

  describe('ungroupTab', () => {
    it('ungroups a split tab into individual tabs', () => {
      const pane1 = createPane('~/a')
      const tabId = useTabStore.getState().addTab(pane1)

      const pane2 = createPane('~/b')
      useTabStore.getState().splitTab(tabId, pane2)

      useTabStore.getState().ungroupTab(tabId)

      const state = useTabStore.getState()
      expect(state.tabs).toHaveLength(2)
      expect(state.tabs[0].type).toBe('single')
      expect(state.tabs[1].type).toBe('single')
    })
  })

  describe('updatePaneCwd', () => {
    it('updates a pane cwd', () => {
      const pane = createPane('~')
      useTabStore.getState().addTab(pane)

      useTabStore.getState().updatePaneCwd(pane.id, '~/new-dir')
      const updatedPane = useTabStore.getState().tabs[0].panes[0]
      expect(updatedPane.cwd).toBe('~/new-dir')
    })
  })

  describe('closeAllTabs', () => {
    it('closes all tabs and saves them to closedTabs', () => {
      useTabStore.getState().addTab(createPane('~/a'))
      useTabStore.getState().addTab(createPane('~/b'))
      useTabStore.getState().addTab(createPane('~/c'))

      useTabStore.getState().closeAllTabs()

      const state = useTabStore.getState()
      expect(state.tabs).toHaveLength(0)
      expect(state.activeTabId).toBeNull()
      expect(state.closedTabs).toHaveLength(3)
    })
  })

  describe('restoreClosedTab', () => {
    it('restores the most recently closed tab', () => {
      const pane = createPane('~/restored')
      useTabStore.getState().addTab(pane)
      const tabId = useTabStore.getState().tabs[0].id
      useTabStore.getState().closeTabEntry(tabId)

      expect(useTabStore.getState().tabs).toHaveLength(0)

      useTabStore.getState().restoreClosedTab()

      const state = useTabStore.getState()
      expect(state.tabs).toHaveLength(1)
      expect(state.tabs[0].panes[0].cwd).toBe('~/restored')
      expect(state.closedTabs).toHaveLength(0)
    })
  })

  describe('setSplitSize', () => {
    it('sets split size for a tab', () => {
      useTabStore.getState().setSplitSize('tab-1', 60)
      expect(useTabStore.getState().splitSizes['tab-1']).toBe(60)
    })
  })

  describe('serializeForSave', () => {
    it('serializes tabs for session save', () => {
      const pane = createPane('~/test')
      useTabStore.getState().addTab(pane)

      const serialized = useTabStore.getState().serializeForSave()
      expect(serialized.tabs).toHaveLength(1)
      expect(serialized.tabs[0].panes?.[0].cwd).toBe('~/test')
      expect(serialized.activeTabIndex).toBe(0)
    })
  })
})
