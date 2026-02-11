import { create } from 'zustand'

interface UIState {
  commandPaletteOpen: boolean
  projectPaletteOpen: boolean
  settingsOpen: boolean
  activeDragId: string | null
  sessionLoaded: boolean

  // Actions
  setCommandPaletteOpen: (open: boolean) => void
  setProjectPaletteOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  toggleSettings: () => void
  setActiveDragId: (id: string | null) => void
  setSessionLoaded: (loaded: boolean) => void
  isModalOpen: () => boolean
}

export const useUIStore = create<UIState>((set, get) => ({
  commandPaletteOpen: false,
  projectPaletteOpen: false,
  settingsOpen: false,
  activeDragId: null,
  sessionLoaded: false,

  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setProjectPaletteOpen: (open) => set({ projectPaletteOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),
  setActiveDragId: (id) => set({ activeDragId: id }),
  setSessionLoaded: (loaded) => set({ sessionLoaded: loaded }),

  isModalOpen: () => {
    const { commandPaletteOpen, projectPaletteOpen, settingsOpen } = get()
    return commandPaletteOpen || projectPaletteOpen || settingsOpen
  }
}))
