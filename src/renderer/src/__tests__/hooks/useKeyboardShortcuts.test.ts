import { describe, it, expect, beforeEach, vi } from 'vitest'
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

function dispatchModKey(
  key: string,
  options: Partial<KeyboardEventInit> = {}
): void {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
      ...options
    }))
  })
}

function getProfileFontSize(profileId: string): number {
  const profile = useSettingsStore.getState().settings.profiles.find((p) => p.id === profileId)
  return profile?.shellFontSize ?? TERMINAL_FONT_SIZE_DEFAULT
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks()

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

  it('zooms in with Ctrl/Cmd + =', () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts())
    dispatchModKey('=')
    expect(getProfileFontSize('default')).toBe(TERMINAL_FONT_SIZE_DEFAULT + 1)
    unmount()
  })

  it('zooms in with Ctrl/Cmd + Shift + = (+)', () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts())
    dispatchModKey('+', { shiftKey: true })
    expect(getProfileFontSize('default')).toBe(TERMINAL_FONT_SIZE_DEFAULT + 1)
    unmount()
  })

  it('zooms out with Ctrl/Cmd + -', () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts())
    dispatchModKey('-')
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
    dispatchModKey('0')
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
    dispatchModKey('-')
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

    dispatchModKey('=')
    expect(getProfileFontSize('default')).toBe(TERMINAL_FONT_SIZE_MAX)
    unmount()
  })

  it('applies zoom to active pane profile only', () => {
    const workPane = createPane('~/work', 'zsh', undefined, 'work')
    useTabStore.getState().addTab(workPane)

    const { unmount } = renderHook(() => useKeyboardShortcuts())
    dispatchModKey('=')

    expect(getProfileFontSize('work')).toBe(TERMINAL_FONT_SIZE_DEFAULT + 3)
    expect(getProfileFontSize('default')).toBe(TERMINAL_FONT_SIZE_DEFAULT)
    unmount()
  })

  it('preserves existing Shift+P behavior for command palette', () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts())
    dispatchModKey('P', { shiftKey: true })

    expect(useUIStore.getState().commandPaletteOpen).toBe(true)
    expect(getProfileFontSize('default')).toBe(TERMINAL_FONT_SIZE_DEFAULT)

    unmount()
  })
})
