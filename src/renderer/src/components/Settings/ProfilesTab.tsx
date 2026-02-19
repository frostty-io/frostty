import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { User, Plus } from 'lucide-react'
import { Button } from '../ui/button'
import type { AppSettings, AvailableShell, Profile } from '../../../../shared/ipc'
import { ProfileEditor, generateProfileId } from './ProfileEditor'
import { TERMINAL_FONT_SIZE_DEFAULT } from '../../../../shared/constants'

interface ProfilesTabProps {
  settings: AppSettings
  onSave: (settings: AppSettings) => void
}

export function ProfilesTab({ settings, onSave }: ProfilesTabProps) {
  const [availableShells, setAvailableShells] = useState<AvailableShell[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    settings.defaultProfileId ?? settings.profiles[0]?.id ?? null
  )

  useEffect(() => {
    window.electronAPI.getAvailableShells().then(setAvailableShells)
  }, [settings])

  // Make sure selectedProfileId is valid
  useEffect(() => {
    if (!selectedProfileId || !settings.profiles.find(p => p.id === selectedProfileId)) {
      setSelectedProfileId(settings.defaultProfileId ?? settings.profiles[0]?.id ?? null)
    }
  }, [settings.profiles, selectedProfileId, settings.defaultProfileId])

  const update = (partial: Partial<AppSettings>) => {
    onSave({ ...settings, ...partial })
  }

  const updateProfile = (updated: Profile) => {
    const newProfiles = settings.profiles.map(p =>
      p.id === updated.id ? updated : p
    )
    update({ profiles: newProfiles })
  }

  const addProfile = () => {
    const newProfile: Profile = {
      id: generateProfileId(),
      name: 'New Profile',
      shell: 'system',
      homeDirectory: '~',
      tabColor: '#3b82f6',
      shellFontSize: TERMINAL_FONT_SIZE_DEFAULT
    }
    update({ profiles: [...settings.profiles, newProfile] })
    setSelectedProfileId(newProfile.id)
  }

  const duplicateProfile = (profile: Profile) => {
    const newProfile: Profile = {
      id: generateProfileId(),
      name: `${profile.name} (copy)`,
      shell: profile.shell,
      homeDirectory: profile.homeDirectory,
      tabColor: profile.tabColor,
      shellFontSize: profile.shellFontSize
    }
    const idx = settings.profiles.findIndex(p => p.id === profile.id)
    const newProfiles = [...settings.profiles]
    newProfiles.splice(idx + 1, 0, newProfile)
    update({ profiles: newProfiles })
    setSelectedProfileId(newProfile.id)
  }

  const deleteProfile = (profileId: string) => {
    if (settings.profiles.length <= 1) return
    const newProfiles = settings.profiles.filter(p => p.id !== profileId)
    const newSettings: Partial<AppSettings> = { profiles: newProfiles }

    // If we're deleting the default profile, set a new default
    if (settings.defaultProfileId === profileId) {
      newSettings.defaultProfileId = newProfiles[0].id
    }

    update(newSettings)
    if (selectedProfileId === profileId) {
      setSelectedProfileId(newProfiles[0].id)
    }
  }

  const setDefaultProfile = (profileId: string) => {
    update({ defaultProfileId: profileId })
  }

  const selectedProfile = settings.profiles.find(p => p.id === selectedProfileId)

  return (
    <div className="flex h-full">
      {/* Left: Profile list */}
      <div className="w-72 shrink-0 border-r border-[hsl(220,15%,14%)] overflow-y-auto p-6">
        <div className="space-y-1.5">
          {settings.profiles.map(profile => {
            const isDefault = profile.id === settings.defaultProfileId
            const isSelected = profile.id === selectedProfileId
            return (
              <button
                key={profile.id}
                onClick={() => setSelectedProfileId(profile.id)}
                className={cn(
                  'w-full px-3 py-2.5 rounded-lg flex items-center gap-3 text-left',
                  'transition-all duration-150 border',
                  isSelected
                    ? 'bg-accent/10 border-accent/30'
                    : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/5'
                )}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: isSelected ? `${profile.tabColor}33` : `${profile.tabColor}15`,
                    color: profile.tabColor
                  }}
                >
                  <User className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate flex items-center gap-2">
                    {profile.name}
                    {isDefault && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent font-semibold uppercase tracking-wider">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {profile.shell === 'system' ? 'System shell' : profile.shell} · {profile.homeDirectory}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Add Profile Button */}
        <div className="mt-3">
          <Button
            variant="outline"
            onClick={addProfile}
            className="w-full justify-start gap-3 border-dashed h-auto py-2.5"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[hsl(220,15%,14%)] shrink-0">
              <Plus className="w-4 h-4" />
            </div>
            <span>Add Profile</span>
          </Button>
        </div>
      </div>

      {/* Right: Profile editor */}
      <div className="flex-1 min-w-0 overflow-y-auto p-8">
        {selectedProfile ? (
          <ProfileEditor
            key={selectedProfile.id}
            profile={selectedProfile}
            isDefault={selectedProfile.id === settings.defaultProfileId}
            isOnly={settings.profiles.length === 1}
            availableShells={availableShells}
            onUpdate={updateProfile}
            onSetDefault={() => setDefaultProfile(selectedProfile.id)}
            onDuplicate={() => duplicateProfile(selectedProfile)}
            onDelete={() => deleteProfile(selectedProfile.id)}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Select a profile to edit
          </div>
        )}
      </div>
    </div>
  )
}
