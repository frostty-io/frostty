import { create } from 'zustand'

interface UIState {
  commandPaletteOpen: boolean
  projectPaletteOpen: boolean
  settingsOpen: boolean
  branchSelectorOpen: boolean
  branchSelectorCreateMode: boolean
  activeDragId: string | null
  sessionLoaded: boolean

  // Actions
  setCommandPaletteOpen: (open: boolean) => void
  setProjectPaletteOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  setBranchSelectorOpen: (open: boolean) => void
  openBranchSelector: () => void
  openBranchSelectorInCreateMode: () => void
  closeBranchSelector: () => void
  toggleSettings: () => void
  setActiveDragId: (id: string | null) => void
  setSessionLoaded: (loaded: boolean) => void
  isModalOpen: () => boolean
}

export const useUIStore = create<UIState>((set, get) => ({
  commandPaletteOpen: false,
  projectPaletteOpen: false,
  settingsOpen: false,
  branchSelectorOpen: false,
  branchSelectorCreateMode: false,
  activeDragId: null,
  sessionLoaded: false,

  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setProjectPaletteOpen: (open) => set({ projectPaletteOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setBranchSelectorOpen: (open) => set({ branchSelectorOpen: open, ...(!open && { branchSelectorCreateMode: false }) }),
  openBranchSelector: () => set({ branchSelectorOpen: true }),
  openBranchSelectorInCreateMode: () => set({ branchSelectorOpen: true, branchSelectorCreateMode: true }),
  closeBranchSelector: () => set({ branchSelectorOpen: false, branchSelectorCreateMode: false }),
  toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),
  setActiveDragId: (id) => set({ activeDragId: id }),
  setSessionLoaded: (loaded) => set({ sessionLoaded: loaded }),

  isModalOpen: () => {
    const { commandPaletteOpen, projectPaletteOpen, settingsOpen, branchSelectorOpen } = get()
    return commandPaletteOpen || projectPaletteOpen || settingsOpen || branchSelectorOpen
  }
}))
