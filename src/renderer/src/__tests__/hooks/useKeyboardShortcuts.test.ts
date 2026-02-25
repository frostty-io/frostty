import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useTabStore, createPane } from '../../stores/useTabStore'
import { useUIStore } from '../../stores/useUIStore'
import { DEFAULT_SETTINGS } from '../../../../shared/ipc'
import {
  TERMINAL_FONT_SIZE_DEFAULT,
  TERMINAL_FONT_SIZE_MAX,
  TERMINAL_FONT_SIZE_MIN
} from '../../../../shared/constants'

const ORIGINAL_PLATFORM = navigator.platform

function setPlatform(platform: string): void {
  Object.defineProperty(window.navigator, 'platform', {
    value: platform,
    configurable: true
  })
}

function dispatchKey(
  key: string,
  options: Partial<KeyboardEventInit> = {}
): void {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...options
    }))
  })
}

function dispatchCtrlKey(
  key: string,
  options: Partial<KeyboardEventInit> = {}
): void {
  dispatchKey(key, { ctrlKey: true, ...options })
}

function dispatchCmdKey(
  key: string,
  options: Partial<KeyboardEventInit> = {}
): void {
  dispatchKey(key, { metaKey: true, ...options })
}

function getProfileFontSize(profileId: string): number {
  const profile = useSettingsStore.getState().settings.profiles.find((p) => p.id === profileId)
  return profile?.shellFontSize ?? TERMINAL_FONT_SIZE_DEFAULT
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setPlatform('Linux x86_64')

    useSettingsStore.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        profiles: [
          { id: 'default', name: 'Default', shell: 'system', homeDirectory: '~', tabColor: '#3b82f6', shellFontSize: TERMINAL_FONT_SIZE_DEFAULT },
          { id: 'work', name: 'Work', shell: 'zsh', homeDirectory: '~/work', tabColor: '#ef4444', shellFontSize: TERMINAL_FONT_SIZE_DEFAULT + 2 }
        ],
        defaultProfileId: 'default'
      },
      settingsLoaded: true,
      cachedRepos: [],
      reposLoading: false
    })

    useTabStore.setState({
      tabs: [],
      activeTabId: null,
      closedTabs: [],
      splitSizes: {},
      terminalRefs: new Map(),
      initialContentMap: new Map()
    })

    useUIStore.setState({
      commandPaletteOpen: false,
      projectPaletteOpen: false,
      settingsOpen: false,
      activeDragId: null,
      sessionLoaded: false
    })
  })

  afterEach(() => {
    setPlatform(ORIGINAL_PLATFORM)
  })

  it('zooms in with Ctrl/Cmd + =', () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts())
    dispatchCtrlKey('=')
    expect(getProfileFontSize('default')).toBe(TERMINAL_FONT_SIZE_DEFAULT + 1)
    unmount()
  })

  it('zooms in with Ctrl/Cmd + Shift + = (+)', () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts())
    dispatchCtrlKey('+', { shiftKey: true })
    expect(getProfileFontSize('default')).toBe(TERMINAL_FONT_SIZE_DEFAULT + 1)
    unmount()
  })

  it('zooms out with Ctrl/Cmd + -', () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts())
    dispatchCtrlKey('-')
    expect(getProfileFontSize('default')).toBe(TERMINAL_FONT_SIZE_DEFAULT - 1)
    unmount()
  })

  it('resets zoom with Ctrl/Cmd + 0', () => {
    useSettingsStore.setState((state) => ({
      settings: {
        ...state.settings,
        profiles: state.settings.profiles.map((profile) => (
          profile.id === 'default'
            ? { ...profile, shellFontSize: TERMINAL_FONT_SIZE_DEFAULT + 5 }
            : profile
        ))
      }
    }))

    const { unmount } = renderHook(() => useKeyboardShortcuts())
    dispatchCtrlKey('0')
    expect(getProfileFontSize('default')).toBe(TERMINAL_FONT_SIZE_DEFAULT)
    unmount()
  })

  it('clamps zoom level at min and max limits', () => {
    useSettingsStore.setState((state) => ({
      settings: {
        ...state.settings,
        profiles: state.settings.profiles.map((profile) => (
          profile.id === 'default'
            ? { ...profile, shellFontSize: TERMINAL_FONT_SIZE_MIN }
            : profile
        ))
      }
    }))

    const { unmount } = renderHook(() => useKeyboardShortcuts())
    dispatchCtrlKey('-')
    expect(getProfileFontSize('default')).toBe(TERMINAL_FONT_SIZE_MIN)

    useSettingsStore.setState((state) => ({
      settings: {
        ...state.settings,
        profiles: state.settings.profiles.map((profile) => (
          profile.id === 'default'
            ? { ...profile, shellFontSize: TERMINAL_FONT_SIZE_MAX }
            : profile
        ))
      }
    }))

    dispatchCtrlKey('=')
    expect(getProfileFontSize('default')).toBe(TERMINAL_FONT_SIZE_MAX)
    unmount()
  })

  it('applies zoom to active pane profile only', () => {
    const workPane = createPane('~/work', 'zsh', undefined, 'work')
    useTabStore.getState().addTab(workPane)

    const { unmount } = renderHook(() => useKeyboardShortcuts())
    dispatchCtrlKey('=')

    expect(getProfileFontSize('work')).toBe(TERMINAL_FONT_SIZE_DEFAULT + 3)
    expect(getProfileFontSize('default')).toBe(TERMINAL_FONT_SIZE_DEFAULT)
    unmount()
  })

  it('opens command palette with Ctrl+Shift+P on non-mac', () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts())
    dispatchCtrlKey('p', { shiftKey: true })
    expect(useUIStore.getState().commandPaletteOpen).toBe(true)
    unmount()
  })

  it('uses remapped Ctrl+Shift+O for project palette on non-mac', () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts())
    dispatchCtrlKey('o', { shiftKey: true })
    expect(useUIStore.getState().projectPaletteOpen).toBe(true)
    unmount()
  })

  it('does not open project palette with Ctrl+P on non-mac', () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts())
    dispatchCtrlKey('p')
    expect(useUIStore.getState().projectPaletteOpen).toBe(false)
    unmount()
  })

  it('uses remapped Ctrl+Shift+T for new tab on non-mac', () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts())
    dispatchCtrlKey('t', { shiftKey: true })
    expect(useTabStore.getState().tabs).toHaveLength(1)
    unmount()
  })

  it('does not open a new tab with Ctrl+T on non-mac', () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts())
    dispatchCtrlKey('t')
    expect(useTabStore.getState().tabs).toHaveLength(0)
    unmount()
  })

  it('uses cmd-only bindings on macOS', () => {
    setPlatform('MacIntel')
    const { unmount } = renderHook(() => useKeyboardShortcuts())

    dispatchCtrlKey('p')
    expect(useUIStore.getState().projectPaletteOpen).toBe(false)

    dispatchCmdKey('p')
    expect(useUIStore.getState().projectPaletteOpen).toBe(true)
    unmount()
  })
})
