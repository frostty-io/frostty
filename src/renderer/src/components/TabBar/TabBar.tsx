import {
  SortableContext,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { Plus, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { usePlatform } from '@/hooks/usePlatform'
import { useTabStore } from '@/stores/useTabStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useUIStore } from '@/stores/useUIStore'
import SortableTabItem from './TabItem'
import TabBarFooter, { SystemStatsBar } from './TabBarFooter'

interface TabBarProps {
  onTabClick: (tabId: string) => void
  onTabClose: (tabId: string) => void
  onNewTab: (profileId?: string) => void
  onPaneClick?: (tabId: string, paneId: string) => void
  onPaneClose?: (tabId: string, paneId: string) => void
  onUngroupTab?: (tabId: string) => void
  onSettingsClick: () => void
}

export default function TabBar({
  onTabClick,
  onTabClose,
  onNewTab,
  onPaneClick,
  onPaneClose,
  onUngroupTab,
  onSettingsClick
}: TabBarProps) {
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const profiles = useSettingsStore((s) => s.settings.profiles)
  const defaultProfileId = useSettingsStore((s) => s.settings.defaultProfileId)
  const settingsOpen = useUIStore((s) => s.settingsOpen)
  const { isMac } = usePlatform()

  const newTabKey = isMac ? ['⌘', 'T'] : ['Ctrl', 'T']

  return (
    <div className="w-64 flex flex-col no-select bg-[hsl(var(--sidebar-bg))] border-r border-white/5">
      {/* System Stats Bar */}
      <SystemStatsBar />

      {/* Tab List — SortableContext relies on parent DndContext in App */}
      <SortableContext
        items={tabs.map(t => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex-1 overflow-y-auto p-2 flex flex-col">
          <div className={`space-y-1 ${tabs.length > 0 ? 'mb-3' : ''}`}>
            {tabs.map((tab, index) => (
              <SortableTabItem
                key={tab.id}
                tab={tab}
                index={index}
                isActive={tab.id === activeTabId}
                settingsOpen={settingsOpen}
                onTabClick={onTabClick}
                onTabClose={onTabClose}
                onPaneClick={onPaneClick}
                onPaneClose={onPaneClose}
                onUngroupTab={onUngroupTab}
                profiles={profiles}
              />
            ))}
          </div>

          {/* New Tab - directly below tabs */}
          <div className="flex items-center gap-0">
            <Button
              onClick={() => onNewTab()}
              variant="secondary"
              className={`w-full
                ${profiles.length >= 2 ? 'rounded-r-none border-r-0' : ''}
              `}
              title={`New tab (${newTabKey.join('+')})`}
            >
              <Plus className="w-4 h-4 transition-transform duration-200 group-hover/btn:scale-110" />
              <span className="flex-1 text-left">New tab</span>
              <KbdGroup>
                <Kbd>{newTabKey[0]}</Kbd>
                <span>+</span>
                <Kbd>{newTabKey[1]}</Kbd>
              </KbdGroup>
            </Button>

            {/* Profile dropdown - only shown when 2+ profiles exist */}
            {profiles.length >= 2 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    className="px-1.5 py-2 rounded-l-none"
                    title="New tab with profile..."
                  >
                    <ChevronDown className="w-4 h-4 outline-none" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="bottom" className="w-56">
                  <DropdownMenuLabel className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                    New tab with profile
                  </DropdownMenuLabel>
                  {profiles.map(profile => {
                    const isDefault = profile.id === defaultProfileId
                    return (
                      <DropdownMenuItem
                        key={profile.id}
                        onClick={() => onNewTab(profile.id)}
                        className="flex-col items-start gap-0.5 cursor-pointer"
                      >
                        <div className="text-sm text-foreground truncate flex items-center gap-1.5 w-full">
                          {profile.name}
                          {isDefault && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-accent/15 text-accent font-medium">
                              default
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate w-full">
                          {profile.shell === 'system' ? 'System shell' : profile.shell} · {profile.homeDirectory}
                        </div>
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </SortableContext>

      {/* Footer: Settings */}
      <TabBarFooter settingsOpen={settingsOpen} onSettingsClick={onSettingsClick} />
    </div>
  )
}
