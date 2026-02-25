import { Cpu, HardDrive, Settings } from 'lucide-react'
import { useSystemStats } from '@/hooks/useSystemStats'
import { usePlatform } from '@/hooks/usePlatform'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { getShortcutDisplay } from '@/lib/shortcutRegistry'

function StatBar({ value, icon: Icon, color }: { value: number; icon: typeof Cpu; color: string }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1 mb-1">
        <Icon className={`w-3 h-3 ${color}`} />
        <span className={`text-[10px] font-mono font-semibold ${color}`}>{value}%</span>
      </div>
      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${
            value > 80 ? 'bg-red-500' : value > 60 ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  )
}

export function SystemStatsBar() {
  const stats = useSystemStats()

  return (
    <div className="p-2.5 border-b border-white/5">
      <div className="flex gap-3">
        <StatBar
          value={stats?.cpuUsage ?? 0}
          icon={Cpu}
          color="text-cyan-400"
        />
        <StatBar
          value={stats?.memoryUsage ?? 0}
          icon={HardDrive}
          color="text-violet-400"
        />
      </div>
    </div>
  )
}

interface TabBarFooterProps {
  settingsOpen: boolean
  onSettingsClick: () => void
}

export default function TabBarFooter({ settingsOpen, onSettingsClick }: TabBarFooterProps) {
  const { isMac } = usePlatform()
  const settingsShortcut = getShortcutDisplay('settings', isMac)

  return (
    <div className="shrink-0 border-t border-white/5">
      <button
        onClick={onSettingsClick}
        className={`
          w-full px-4 py-4
          flex items-center gap-2.5
          transition-all duration-200
          group/settings
          ${settingsOpen
            ? 'text-accent'
            : 'text-muted-foreground/60 hover:text-muted-foreground'
          }
        `}
        title={`Settings (${settingsShortcut.join('+')})`}
      >
        <Settings className={`w-3.5 h-3.5 transition-all duration-200 ${settingsOpen ? 'text-accent rotate-90' : 'group-hover/settings:rotate-45'}`} />
        <span className="text-sm font-medium flex-1 text-left">Settings</span>
        <KbdGroup>
          <Kbd className={settingsOpen ? 'bg-[hsl(var(--sidebar-bg))] text-accent border-muted' : ''}>{settingsShortcut[0]}</Kbd>
          <span>+</span>
          <Kbd className={settingsOpen ? 'bg-[hsl(var(--sidebar-bg))] text-accent border-muted' : ''}>{settingsShortcut[1]}</Kbd>
        </KbdGroup>
      </button>
    </div>
  )
}
