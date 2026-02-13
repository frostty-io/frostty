import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Folder,
  Terminal,
  ChevronDown,
  Check,
  User,
  Copy,
  Trash2,
  Star
} from 'lucide-react'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../ui/dropdown-menu'
import { SHELL_OPTIONS, normalizeHomeDirectory } from '../../../../shared/ipc'
import type { ShellType, AvailableShell, Profile } from '../../../../shared/ipc'
import { SettingField, INPUT_CLASSES } from './SettingField'
import { TabColorPicker } from './TabColorPicker'

// Generate a unique profile ID
export function generateProfileId(): string {
  return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function ProfileEditor({
  profile,
  isDefault,
  isOnly,
  availableShells,
  onUpdate,
  onSetDefault,
  onDuplicate,
  onDelete
}: {
  profile: Profile
  isDefault: boolean
  isOnly: boolean
  availableShells: AvailableShell[]
  onUpdate: (updated: Profile) => void
  onSetDefault: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const [localName, setLocalName] = useState(profile.name)
  const [localHomeDir, setLocalHomeDir] = useState(profile.homeDirectory)

  // Sync when profile changes
  useEffect(() => {
    setLocalName(profile.name)
    setLocalHomeDir(profile.homeDirectory)
  }, [profile.id, profile.name, profile.homeDirectory])

  const getShellLabel = (shellType: ShellType): string => {
    const option = SHELL_OPTIONS.find(o => o.value === shellType)
    return option?.label || 'System Default'
  }

  const isShellAvailable = (shellType: ShellType): boolean => {
    if (shellType === 'system') return true
    const shell = availableShells.find(s => s.type === shellType)
    return shell?.available ?? false
  }

  const handleBrowse = async () => {
    try {
      const selected = await window.electronAPI.pickDirectory()
      if (selected) {
        setLocalHomeDir(selected)
        onUpdate({ ...profile, homeDirectory: selected })
      }
    } catch {
      // Dialog cancelled or unavailable
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-[hsl(220,15%,14%)]">
        <div className="w-10 h-10 rounded-xl bg-accent/15 text-accent flex items-center justify-center shrink-0">
          <User className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate flex items-center gap-2">
            {profile.name}
            {isDefault && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent font-semibold uppercase tracking-wider">
                Default
              </span>
            )}
          </h3>
          <p className="text-xs text-muted-foreground truncate">
            {profile.shell === 'system' ? 'System shell' : profile.shell} · {profile.homeDirectory}
          </p>
        </div>
      </div>

      {/* Profile Name */}
      <SettingField label="Name" description="A display name for this profile.">
        <input
          type="text"
          value={localName}
          onChange={(e) => {
            setLocalName(e.target.value)
            onUpdate({ ...profile, name: e.target.value })
          }}
          onBlur={() => {
            const trimmed = localName.trim() || 'Untitled'
            setLocalName(trimmed)
            onUpdate({ ...profile, name: trimmed })
          }}
          placeholder="Profile name"
          className={cn(INPUT_CLASSES, 'px-3')}
        />
      </SettingField>

      {/* Shell */}
      <SettingField
        label="Shell"
        description="The shell to use for new tabs with this profile."
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between bg-popover border-[hsl(220,15%,20%)] hover:bg-popover hover:border-[hsl(220,15%,28%)]"
            >
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">{getShellLabel(profile.shell)}</span>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="min-w-(--radix-dropdown-menu-trigger-width)"
          >
            {SHELL_OPTIONS.map((option) => {
              const available = isShellAvailable(option.value)
              const isSelected = profile.shell === option.value
              return (
                <DropdownMenuItem
                  key={option.value}
                  disabled={!available}
                  onClick={() => onUpdate({ ...profile, shell: option.value })}
                  className={cn(
                    'gap-3 py-2.5 cursor-pointer',
                    isSelected && 'bg-accent/10'
                  )}
                >
                  <div className="w-4 h-4 flex items-center justify-center shrink-0">
                    {isSelected && <Check className="w-4 h-4 text-accent" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground">{option.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {option.description}
                      {!available && ' (not installed)'}
                    </div>
                  </div>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </SettingField>

      {/* Home Directory */}
      <SettingField
        label="Home Directory"
        description={
          <>
            New tabs with this profile will start in this directory. Use{' '}
            <code className="px-1.5 py-0.5 rounded bg-[hsl(220,15%,16%)] text-[hsl(210,100%,65%)] text-[11px] font-mono">
              ~
            </code>{' '}
            for your home directory.
          </>
        }
      >
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Folder className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={localHomeDir}
              onChange={(e) => {
                setLocalHomeDir(e.target.value)
                onUpdate({ ...profile, homeDirectory: e.target.value })
              }}
              onBlur={() => {
                const normalized = normalizeHomeDirectory(localHomeDir)
                setLocalHomeDir(normalized)
                onUpdate({ ...profile, homeDirectory: normalized })
              }}
              placeholder="~"
              className={cn(INPUT_CLASSES, 'pl-10 pr-3')}
            />
          </div>
          <Button onClick={handleBrowse}>
            Browse
          </Button>
        </div>
      </SettingField>

      {/* Tab Color */}
      <TabColorPicker
        color={profile.tabColor}
        onChange={(tabColor) => onUpdate({ ...profile, tabColor })}
      />

      {/* Actions */}
      <div className="flex items-center gap-2 pt-4 border-t border-[hsl(220,15%,14%)]">
        {!isDefault && (
          <Button variant="accent" size="sm" onClick={onSetDefault}>
            <Star className="w-3.5 h-3.5" />
            Set as Default
          </Button>
        )}
        <Button size="sm" onClick={onDuplicate}>
          <Copy className="w-3.5 h-3.5" />
          Duplicate
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={onDelete}
          disabled={isOnly}
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </Button>
      </div>
    </div>
  )
}
