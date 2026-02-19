import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import App from '../App'
import { useTabStore } from '../stores/useTabStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useUIStore } from '../stores/useUIStore'
import { CWD_POLL_INTERVAL } from '../../../shared/constants'

vi.mock('../components/Terminal', () => ({
  default: () => <div data-testid="terminal" />
}))

vi.mock('../components/TabBar', () => ({
  __esModule: true,
  default: () => <div data-testid="tabbar" />,
  TabOverlay: () => null
}))

vi.mock('../components/GitBar', () => ({
  __esModule: true,
  default: () => <div data-testid="gitbar" />
}))

vi.mock('../components/Palette', () => ({
  __esModule: true,
  CommandPalette: () => null,
  ProjectPalette: () => null
}))

vi.mock('../components/EmptyState', () => ({
  __esModule: true,
  default: () => null
}))

vi.mock('../components/Settings', () => ({
  __esModule: true,
  default: () => null
}))

vi.mock('../components/ui/sonner', () => ({
  __esModule: true,
  Toaster: () => null
}))

describe('App CWD polling behavior', () => {
  let ptyCwdListener: ((event: { tabId: string; cwd: string }) => void) | null = null

  beforeEach(() => {
    vi.useFakeTimers()
    ptyCwdListener = null
    vi.mocked(window.electronAPI.onPtyCwd).mockImplementation((cb) => {
      ptyCwdListener = cb
      return () => {
        ptyCwdListener = null
      }
    })

    vi.mocked(window.electronAPI.getCwd).mockReset()
    vi.mocked(window.electronAPI.getCwd).mockResolvedValue('/repo')

    useSettingsStore.setState({
      settingsLoaded: true,
      settings: {
        profiles: [{ id: 'default', name: 'Default', shell: 'system', homeDirectory: '~', tabColor: '#3b82f6', shellFontSize: 12 }],
        defaultProfileId: 'default',
        openRouterApiKey: '',
        openRouterModel: 'openai/gpt-oss-120b'
      },
      cachedRepos: [],
      reposLoading: false
    })

    useUIStore.setState({
      commandPaletteOpen: false,
      projectPaletteOpen: false,
      settingsOpen: false,
      activeDragId: null,
      sessionLoaded: true
    })

    useTabStore.setState({
      tabs: [{
        id: 'tab-1',
        type: 'single',
        panes: [{ id: 'pane-1', title: 'shell', shell: 'shell', cwd: '/repo', shellType: 'system', profileId: 'default' }],
        activePaneId: 'pane-1'
      }],
      activeTabId: 'tab-1',
      closedTabs: [],
      splitSizes: {},
      terminalRefs: new Map(),
      initialContentMap: new Map()
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('skips fallback getCwd polling while OSC7 updates are still fresh', async () => {
    render(<App />)

    expect(ptyCwdListener).toBeTypeOf('function')

    act(() => {
      ptyCwdListener?.({ tabId: 'pane-1', cwd: '/repo' })
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CWD_POLL_INTERVAL)
    })

    expect(window.electronAPI.getCwd).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CWD_POLL_INTERVAL)
    })

    expect(window.electronAPI.getCwd).toHaveBeenCalledWith('pane-1')
  })
})
