import { memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { X, GripVertical, Ungroup, GitBranch } from 'lucide-react'
import {
  ItemContent,
  ItemTitle,
  ItemDescription
} from '@/components/ui/item'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { getShellName, shortenPath, formatHotkey } from '@/lib/terminal-utils'
import { usePlatform } from '@/hooks/usePlatform'
import { useGitRepoInfo } from '@/hooks/useGitRepoInfo'
import type { TabEntry, Profile } from '@shared/ipc'

// Helper: get display title for a pane with profile name
export function getPaneTitle(pane: { shell: string; profileId?: string }, profiles: Profile[]): string {
  const shellName = getShellName(pane.shell)
  if (pane.profileId) {
    const profile = profiles.find(p => p.id === pane.profileId)
    if (profile) return `${profile.name} - ${shellName}`
  }
  return shellName
}

// Helper: resolve the tab color from the primary pane's profile
export function getTabColor(tab: TabEntry, profiles: Profile[]): string {
  const profileId = tab.panes[0]?.profileId
  if (profileId) {
    const profile = profiles.find(p => p.id === profileId)
    if (profile) return profile.tabColor
  }
  return profiles[0]?.tabColor ?? '#3b82f6'
}

// --- Single pane within a split tab (extracted so it can use hooks) ---
function SplitPaneItem({
  pane,
  tabId,
  isPaneFocused,
  activeState,
  showClose,
  onTabClick,
  onPaneClick,
  onPaneClose,
  profiles
}: {
  pane: TabEntry['panes'][0]
  tabId: string
  isPaneFocused: boolean
  activeState: boolean
  showClose: boolean
  onTabClick: (tabId: string) => void
  onPaneClick?: (tabId: string, paneId: string) => void
  onPaneClose?: (tabId: string, paneId: string) => void
  profiles: Profile[]
}) {
  const pShellName = getPaneTitle(pane, profiles)
  const pShortPath = shortenPath(pane.cwd, 2)
  const gitInfo = useGitRepoInfo(pane.cwd)

  return (
    <div
      className={`
        group/pane relative flex-1 min-w-0
        rounded-md px-2.5 py-2 cursor-pointer
        transition-all duration-150
        ${isPaneFocused
          ? activeState
            ? 'bg-accent/15 border border-accent/30'
            : 'bg-white/10 border border-white/10'
          : 'bg-white/3 border border-transparent hover:bg-white/6'
        }
      `}
      onClick={(e) => {
        e.stopPropagation()
        onTabClick(tabId)
        onPaneClick?.(tabId, pane.id)
      }}
    >
      <div className={`font-mono truncate text-[11px] leading-tight ${
        isPaneFocused
          ? activeState ? 'text-text-secondary font-medium' : 'text-muted-foreground font-medium'
          : 'text-muted-foreground/50 group-hover/pane:text-muted-foreground/70'
      }`}>
        {pShellName}
      </div>
      <div className={`font-mono truncate text-[10px] leading-tight mt-0.5 flex items-center gap-1 ${
        isPaneFocused
          ? activeState ? 'text-foreground/80' : 'text-muted-foreground/50'
          : 'text-muted-foreground/30 group-hover/pane:text-muted-foreground/40'
      }`} title={gitInfo?.isRepo ? `${gitInfo.repoName}:${gitInfo.branch}` : pane.cwd}>
        {gitInfo?.isRepo ? (
          <>
            <GitBranch className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate">{gitInfo.repoName}:{gitInfo.branch}</span>
          </>
        ) : (
          pShortPath
        )}
      </div>
      {showClose && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onPaneClose?.(tabId, pane.id)
          }}
          className="
            absolute top-1 right-1
            opacity-0 group-hover/pane:opacity-100
            size-4 rounded
            flex items-center justify-center
            text-muted-foreground/40
            hover:text-destructive hover:bg-destructive/20
            transition-all duration-150
          "
          title="Close pane"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </div>
  )
}

// --- Split pane view inside a tab ---
function SplitTabItem({
  tab,
  activeState,
  onTabClick,
  onPaneClick,
  onPaneClose,
  onUngroupTab,
  profiles
}: {
  tab: TabEntry
  activeState: boolean
  onTabClick: (tabId: string) => void
  onPaneClick?: (tabId: string, paneId: string) => void
  onPaneClose?: (tabId: string, paneId: string) => void
  onUngroupTab?: (tabId: string) => void
  profiles: Profile[]
}) {
  return (
    <div className="relative flex gap-1 w-full">
      {/* Ungroup button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onUngroupTab?.(tab.id)
        }}
        className="
          absolute -bottom-1 -right-1 z-10
          opacity-0 group-hover:opacity-100
          size-5 rounded-md
          flex items-center justify-center
          text-muted-foreground/50
          hover:text-accent hover:bg-accent/15
          bg-[hsl(var(--sidebar-bg))]/90 backdrop-blur-sm
          border border-transparent hover:border-accent/30
          transition-all duration-150
        "
        title="Ungroup into separate tabs"
      >
        <Ungroup className="w-3 h-3" />
      </button>
      {tab.panes.map((pane) => (
        <SplitPaneItem
          key={pane.id}
          pane={pane}
          tabId={tab.id}
          isPaneFocused={tab.activePaneId === pane.id}
          activeState={activeState}
          showClose={tab.panes.length > 1}
          onTabClick={onTabClick}
          onPaneClick={onPaneClick}
          onPaneClose={onPaneClose}
          profiles={profiles}
        />
      ))}
    </div>
  )
}

// --- Sortable Tab Item ---
function SortableTabItem({
  tab,
  index,
  isActive,
  settingsOpen,
  onTabClick,
  onTabClose,
  onPaneClick,
  onPaneClose,
  onUngroupTab,
  profiles
}: {
  tab: TabEntry
  index: number
  isActive: boolean
  settingsOpen: boolean
  onTabClick: (tabId: string) => void
  onTabClose: (tabId: string) => void
  onPaneClick?: (tabId: string, paneId: string) => void
  onPaneClose?: (tabId: string, paneId: string) => void
  onUngroupTab?: (tabId: string) => void
  profiles: Profile[]
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: tab.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1
  }

  const { modSymbol } = usePlatform()
  const activeState = isActive && !settingsOpen
  const isSplit = tab.type === 'split'

  // For display: get shell and cwd info
  const primaryPane = tab.panes[0]
  const shellName = primaryPane ? getPaneTitle(primaryPane, profiles) : 'shell'
  const shortPath = primaryPane ? shortenPath(primaryPane.cwd, 2) : '~'
  const hotkeyParts = index < 9 ? formatHotkey((index + 1).toString(), modSymbol) : null
  const gitInfo = useGitRepoInfo(primaryPane?.cwd)

  // Resolve tab color from profile (always returns a color)
  const profileColor = getTabColor(tab, profiles)

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        ...(activeState ? {
          borderColor: `${profileColor}66`,
          boxShadow: `0 10px 15px -3px ${profileColor}1a`
        } : {})
      }}
      {...attributes}
      {...listeners}
      className={`
        cursor-grab active:cursor-grabbing touch-none
        group relative overflow-hidden
        transition-all duration-200 ease-out
        rounded-lg border
        ${isSplit ? '' : 'flex items-center px-3 py-2.5 gap-3'}
        ${isSplit ? 'p-1' : ''}
        ${activeState
          ? 'bg-[hsl(var(--sidebar-item-active))] shadow-lg'
          : 'bg-transparent border-transparent hover:bg-[hsl(var(--sidebar-item-hover))] hover:border-white/5'
        }
      `}
      onClick={() => onTabClick(tab.id)}
    >
      {/* Profile color indicator bar */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-[3px] transition-opacity duration-200 ${
          activeState ? 'opacity-100' : 'opacity-40 group-hover:opacity-60'
        }`}
        style={{ backgroundColor: profileColor }}
      />
      {isSplit ? (
        <SplitTabItem
          tab={tab}
          activeState={activeState}
          onTabClick={onTabClick}
          onPaneClick={onPaneClick}
          onPaneClose={onPaneClose}
          onUngroupTab={onUngroupTab}
          profiles={profiles}
        />
      ) : (
        <>
          {/* Hotkey Badge */}
          <div className="shrink-0">
            {hotkeyParts ? (
              <KbdGroup>
                <Kbd
                  className={`size-9 text-sm font-normal
                    transition-all duration-200
                    rounded-full border
                    ${activeState
                      ? 'bg-[hsl(var(--sidebar-bg))] border-muted shadow-md'
                      : 'bg-white/5 border-transparent group-hover:bg-white/10'
                    }
                  `}
                  style={{
                    color: profileColor,
                    filter: activeState ? undefined : 'brightness(0.8)'
                  }}
                >
                  {hotkeyParts[0]}{hotkeyParts[1]}
                </Kbd>
              </KbdGroup>
            ) : (
              <div className="size-7 rounded-md bg-white/5 text-muted-foreground border border-transparent flex items-center justify-center text-[11px] shrink-0">
                <GripVertical className="w-3 h-3" />
              </div>
            )}
          </div>

          {/* Single tab content */}
          <ItemContent className="min-w-0 gap-0.5 overflow-hidden">
            <ItemTitle className={`font-mono
              truncate text-xs leading-tight
              transition-colors duration-200
              ${activeState ? 'text-text-secondary font-semibold' : 'text-muted-foreground group-hover:text-foreground'}
            `}>
              {shellName}
            </ItemTitle>
            <ItemDescription
              className={`font-mono
                text-[10px] leading-tight
                transition-colors duration-200
                ${activeState ? 'text-foreground' : 'text-muted-foreground/70'}
              `}
              title={gitInfo?.isRepo ? `${gitInfo.repoName}:${gitInfo.branch}` : primaryPane?.cwd}
            >
              {gitInfo?.isRepo ? (
                <span className="flex items-center gap-1 truncate">
                  <GitBranch className="w-3 h-3 shrink-0" />
                  <span className="truncate">{gitInfo.repoName}:{gitInfo.branch}</span>
                </span>
              ) : (
                shortPath
              )}
            </ItemDescription>
          </ItemContent>

          {/* Close Button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onTabClose(tab.id)
            }}
            className={`
              absolute right-2 top-1/2 -translate-y-1/2
              size-6 rounded-md
              flex items-center justify-center
              opacity-0 group-hover:opacity-100
              transition-all duration-200
              hover:bg-destructive/20 hover:text-destructive
              bg-[hsl(var(--sidebar-bg))]/80 backdrop-blur-sm
              ${activeState ? 'text-muted-foreground' : 'text-muted-foreground/60'}
            `}
            title="Close tab"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  )
}

// --- Tab item for DragOverlay (non-interactive clone) ---
export function TabOverlay({ tab, index, profiles = [] }: { tab: TabEntry; index: number; profiles?: Profile[] }) {
  const { modSymbol } = usePlatform()
  const isSplit = tab.type === 'split'
  const primaryPane = tab.panes[0]
  const shellName = primaryPane ? getShellName(primaryPane.shell) : 'shell'
  const shortPath = primaryPane ? shortenPath(primaryPane.cwd, 2) : '~'
  const hotkeyParts = index < 9 ? formatHotkey((index + 1).toString(), modSymbol) : null

  const profileColor = getTabColor(tab, profiles)

  return (
    <div
      className={`
        cursor-grabbing relative overflow-hidden
        rounded-lg border
        bg-[hsl(var(--sidebar-item-active))] shadow-xl shadow-black/30
        w-60
        ${isSplit ? 'p-1' : 'flex items-center px-3 py-2.5 gap-3'}
      `}
      style={{ borderColor: `${profileColor}66` }}
    >
      {/* Profile color indicator bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ backgroundColor: profileColor }}
      />
      {isSplit ? (
        <div className="flex gap-1 w-full">
          {tab.panes.map((pane) => {
            const pShellName = getShellName(pane.shell)
            const pShortPath = shortenPath(pane.cwd, 2)
            return (
              <div key={pane.id} className="flex-1 min-w-0 rounded-md bg-accent/15 border border-accent/30 px-2.5 py-2">
                <div className="font-mono truncate text-[11px] leading-tight text-text-secondary font-medium">
                  {pShellName}
                </div>
                <div className="font-mono truncate text-[10px] leading-tight mt-0.5 text-foreground/80" title={pane.cwd}>
                  {pShortPath}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <>
          {hotkeyParts ? (
            <KbdGroup>
              <Kbd
                className="size-9 text-sm font-normal rounded-full border bg-[hsl(var(--sidebar-bg))] border-muted shadow-md"
                style={{ color: profileColor }}
              >
                {hotkeyParts[0]}{hotkeyParts[1]}
              </Kbd>
            </KbdGroup>
          ) : (
            <div className="size-7 rounded-md bg-white/5 text-muted-foreground border border-transparent flex items-center justify-center text-[11px] shrink-0">
              <GripVertical className="w-3 h-3" />
            </div>
          )}
          <ItemContent className="min-w-0 gap-0.5 overflow-hidden">
            <ItemTitle className="font-mono truncate text-xs leading-tight text-text-secondary font-semibold">
              {shellName}
            </ItemTitle>
            <ItemDescription className="font-mono truncate text-[10px] leading-tight text-foreground">
              {shortPath}
            </ItemDescription>
          </ItemContent>
        </>
      )}
    </div>
  )
}

const MemoizedSortableTabItem = memo(SortableTabItem)
MemoizedSortableTabItem.displayName = 'SortableTabItem'
export default MemoizedSortableTabItem
