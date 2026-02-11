import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Settings, Sparkles, User } from 'lucide-react'
import { Kbd } from '../ui/kbd'
import type { AppSettings } from '../../../../shared/ipc'
import { ProfilesTab } from './ProfilesTab'
import { AISettings } from './AISettings'

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

interface SettingsTab {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

/** Add new tabs here to extend the settings pane. */
const SETTINGS_TABS: SettingsTab[] = [
  { id: 'profiles', label: 'Profiles', icon: User },
  { id: 'ai', label: 'AI', icon: Sparkles },
]

interface SettingsPaneProps {
  settings: AppSettings
  onSave: (settings: AppSettings) => void
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SettingsPane({ settings, onSave, onClose }: SettingsPaneProps) {
  const [activeTab, setActiveTab] = useState(SETTINGS_TABS[0].id)

  // ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [onClose])

  const update = (partial: Partial<AppSettings>) => {
    onSave({ ...settings, ...partial })
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'profiles':
        return <ProfilesTab settings={settings} onSave={onSave} />
      case 'ai':
        return <AISettings settings={settings} onUpdate={update} />
      default:
        return null
    }
  }

  // ------ Render -----------------------------------------------------------

  return (
    <div className="flex-1 flex flex-col min-h-0 no-select bg-[hsl(var(--background))]">
      {/* Header */}
      <div className="shrink-0 px-8 pt-7 pb-5 border-b border-[hsl(220,15%,14%)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[hsl(220,15%,13%)] border border-[hsl(220,15%,20%)] flex items-center justify-center">
              <Settings className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-foreground leading-tight">Settings</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Configure your preferences</p>
            </div>
          </div>
          <Kbd className="text-[10px] bg-[hsl(220,15%,13%)]">ESC</Kbd>
        </div>
      </div>

      {/* Horizontal tab bar */}
      <div className="shrink-0 px-8 border-b border-[hsl(220,15%,14%)]">
        <div className="flex">
          {SETTINGS_TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative px-4 py-3 flex items-center gap-2 text-sm font-medium',
                  'transition-colors duration-150 rounded-t-md',
                  isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground/80'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {/* Underline indicator */}
                <span
                  className={cn(
                    'absolute bottom-0 left-2 right-2 h-[2px] rounded-full transition-all duration-200',
                    isActive ? 'bg-accent opacity-100' : 'bg-transparent opacity-0'
                  )}
                />
              </button>
            )
          })}
        </div>
      </div>

      {/* Content area — each tab controls its own scroll/layout */}
      <div className="flex-1 min-h-0">
        {renderContent()}
      </div>
    </div>
  )
}
