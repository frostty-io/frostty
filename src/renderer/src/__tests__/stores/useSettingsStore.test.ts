import { describe, it, expect, beforeEach } from 'vitest'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { DEFAULT_SETTINGS } from '../../../../shared/ipc'

describe('useSettingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        profiles: [
          { id: 'default', name: 'Default', shell: 'system', homeDirectory: '~', tabColor: '#3b82f6' },
          { id: 'work', name: 'Work', shell: 'zsh', homeDirectory: '~/work', tabColor: '#ef4444' }
        ]
      },
      settingsLoaded: true,
      cachedRepos: [],
      reposLoading: false
    })
  })

  describe('getProfile', () => {
    it('returns profile by ID', () => {
      const profile = useSettingsStore.getState().getProfile('work')
      expect(profile.name).toBe('Work')
      expect(profile.shell).toBe('zsh')
    })

    it('falls back to default profile', () => {
      const profile = useSettingsStore.getState().getProfile('nonexistent')
      expect(profile.name).toBe('Default')
    })

    it('returns default when no ID given', () => {
      const profile = useSettingsStore.getState().getProfile()
      expect(profile.id).toBe('default')
    })
  })

  describe('getDefaultProfile', () => {
    it('returns the default profile', () => {
      const profile = useSettingsStore.getState().getDefaultProfile()
      expect(profile.id).toBe('default')
      expect(profile.name).toBe('Default')
    })
  })

  describe('updateProfile', () => {
    it('updates a profile', () => {
      useSettingsStore.getState().updateProfile({
        id: 'work',
        name: 'Work Updated',
        shell: 'bash',
        homeDirectory: '~/work',
        tabColor: '#22c55e'
      })

      const profile = useSettingsStore.getState().settings.profiles.find((p) => p.id === 'work')
      expect(profile?.name).toBe('Work Updated')
      expect(profile?.shell).toBe('bash')
    })
  })

  describe('addProfile', () => {
    it('adds a new profile', () => {
      useSettingsStore.getState().addProfile({
        id: 'new',
        name: 'New Profile',
        shell: 'fish',
        homeDirectory: '~/new',
        tabColor: '#06b6d4'
      })

      const profiles = useSettingsStore.getState().settings.profiles
      expect(profiles).toHaveLength(3)
      expect(profiles[2].name).toBe('New Profile')
    })
  })

  describe('deleteProfile', () => {
    it('deletes a profile', () => {
      useSettingsStore.getState().deleteProfile('work')
      const profiles = useSettingsStore.getState().settings.profiles
      expect(profiles).toHaveLength(1)
      expect(profiles[0].id).toBe('default')
    })

    it('does not delete the last profile', () => {
      useSettingsStore.getState().deleteProfile('work')
      useSettingsStore.getState().deleteProfile('default')
      // Should still have 1 profile
      expect(useSettingsStore.getState().settings.profiles).toHaveLength(1)
    })

    it('updates default when deleting the default profile', () => {
      useSettingsStore.getState().setDefaultProfile('work')
      useSettingsStore.getState().deleteProfile('work')
      expect(useSettingsStore.getState().settings.defaultProfileId).toBe('default')
    })
  })

  describe('setDefaultProfile', () => {
    it('sets the default profile', () => {
      useSettingsStore.getState().setDefaultProfile('work')
      expect(useSettingsStore.getState().settings.defaultProfileId).toBe('work')
    })
  })

  describe('updateSettings', () => {
    it('merges partial settings', () => {
      useSettingsStore.getState().updateSettings({
        openRouterApiKey: 'sk-test-key',
        openRouterModel: 'new-model'
      })

      const { settings } = useSettingsStore.getState()
      expect(settings.openRouterApiKey).toBe('sk-test-key')
      expect(settings.openRouterModel).toBe('new-model')
      // Other settings preserved
      expect(settings.profiles).toHaveLength(2)
    })
  })
})
