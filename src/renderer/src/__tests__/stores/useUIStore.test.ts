import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '../../stores/useUIStore'

describe('useUIStore', () => {
  beforeEach(() => {
    useUIStore.setState({
      commandPaletteOpen: false,
      projectPaletteOpen: false,
      settingsOpen: false,
      activeDragId: null,
      sessionLoaded: false
    })
  })

  it('toggles command palette', () => {
    useUIStore.getState().setCommandPaletteOpen(true)
    expect(useUIStore.getState().commandPaletteOpen).toBe(true)

    useUIStore.getState().setCommandPaletteOpen(false)
    expect(useUIStore.getState().commandPaletteOpen).toBe(false)
  })

  it('toggles project palette', () => {
    useUIStore.getState().setProjectPaletteOpen(true)
    expect(useUIStore.getState().projectPaletteOpen).toBe(true)
  })

  it('toggles settings', () => {
    useUIStore.getState().toggleSettings()
    expect(useUIStore.getState().settingsOpen).toBe(true)

    useUIStore.getState().toggleSettings()
    expect(useUIStore.getState().settingsOpen).toBe(false)
  })

  it('tracks modal open state', () => {
    expect(useUIStore.getState().isModalOpen()).toBe(false)

    useUIStore.getState().setCommandPaletteOpen(true)
    expect(useUIStore.getState().isModalOpen()).toBe(true)

    useUIStore.getState().setCommandPaletteOpen(false)
    useUIStore.getState().setSettingsOpen(true)
    expect(useUIStore.getState().isModalOpen()).toBe(true)
  })

  it('manages drag state', () => {
    useUIStore.getState().setActiveDragId('tab-1')
    expect(useUIStore.getState().activeDragId).toBe('tab-1')

    useUIStore.getState().setActiveDragId(null)
    expect(useUIStore.getState().activeDragId).toBeNull()
  })

  it('tracks session loaded state', () => {
    expect(useUIStore.getState().sessionLoaded).toBe(false)

    useUIStore.getState().setSessionLoaded(true)
    expect(useUIStore.getState().sessionLoaded).toBe(true)
  })
})
