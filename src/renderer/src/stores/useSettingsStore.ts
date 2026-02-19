import { create } from 'zustand'
import type { AppSettings, Profile, GitRepoInfo } from '../../../shared/ipc'
import { DEFAULT_SETTINGS } from '../../../shared/ipc'

interface SettingsState {
  settings: AppSettings
  settingsLoaded: boolean
  cachedRepos: GitRepoInfo[]
  reposLoading: boolean

  // Actions
  setSettings: (settings: AppSettings) => void
  updateSettings: (partial: Partial<AppSettings>) => void
  loadSettings: () => Promise<void>
  saveSettings: () => void

  // Profile management
  getProfile: (profileId?: string) => Profile
  getDefaultProfile: () => Profile
  updateProfile: (updated: Profile) => void
  addProfile: (profile: Profile) => void
  deleteProfile: (profileId: string) => void
  setDefaultProfile: (profileId: string) => void

  // Repos
  setCachedRepos: (repos: GitRepoInfo[]) => void
  setReposLoading: (loading: boolean) => void
  fetchRepos: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  settingsLoaded: false,
  cachedRepos: [],
  reposLoading: true,

  setSettings: (settings) => {
    set({ settings })
  },

  updateSettings: (partial) => {
    const { settings } = get()
    const updated = { ...settings, ...partial }
    set({ settings: updated })
  },

  loadSettings: async () => {
    try {
      const loaded = await window.electronAPI.loadSettings()
      set({ settings: loaded, settingsLoaded: true })
    } catch {
      set({ settingsLoaded: true })
    }
  },

  saveSettings: () => {
    const { settings, settingsLoaded } = get()
    if (!settingsLoaded) return
    window.electronAPI.saveSettings(settings)
  },

  getProfile: (profileId?: string) => {
    const { settings } = get()
    if (profileId) {
      const found = settings.profiles.find((p) => p.id === profileId)
      if (found) return found
    }
    const defaultProfile = settings.profiles.find((p) => p.id === settings.defaultProfileId)
    return defaultProfile || settings.profiles[0]
  },

  getDefaultProfile: () => {
    const { settings } = get()
    return settings.profiles.find((p) => p.id === settings.defaultProfileId) || settings.profiles[0]
  },

  updateProfile: (updated) => {
    const { settings } = get()
    const newProfiles = settings.profiles.map((p) => (p.id === updated.id ? updated : p))
    get().updateSettings({ profiles: newProfiles })
  },

  addProfile: (profile) => {
    const { settings } = get()
    get().updateSettings({ profiles: [...settings.profiles, profile] })
  },

  deleteProfile: (profileId) => {
    const { settings } = get()
    if (settings.profiles.length <= 1) return

    const newProfiles = settings.profiles.filter((p) => p.id !== profileId)
    const partial: Partial<AppSettings> = { profiles: newProfiles }

    if (settings.defaultProfileId === profileId) {
      partial.defaultProfileId = newProfiles[0].id
    }

    get().updateSettings(partial)
  },

  setDefaultProfile: (profileId) => {
    get().updateSettings({ defaultProfileId: profileId })
  },

  setCachedRepos: (repos) => set({ cachedRepos: repos }),
  setReposLoading: (loading) => set({ reposLoading: loading }),

  fetchRepos: async () => {
    const defaultProfile = get().getDefaultProfile()
    set({ reposLoading: true })
    try {
      const repos = await window.electronAPI.scanGitRepos(defaultProfile.homeDirectory)
      set({ cachedRepos: repos, reposLoading: false })
    } catch {
      set({ reposLoading: false })
    }
  }
}))
