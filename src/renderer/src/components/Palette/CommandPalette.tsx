import { useState, useEffect, useCallback, useMemo } from 'react'
import { Kbd } from '../ui/kbd'
import { cn } from '@/lib/utils'
import {
  X,
  XCircle,
  Terminal,
  Eraser,
  Settings,
  RefreshCw,
  RotateCcw,
  Download,
  FolderGit2,
  Clock,
  User,
  AppWindow,
  type LucideIcon
} from 'lucide-react'
import { VSCodeIcon, CursorIcon } from '../icons'

// Custom icon type that includes our SVG icons
type CommandIcon = LucideIcon | typeof VSCodeIcon | typeof CursorIcon
import { toast } from 'sonner'
import type { GitOperationResult, Profile } from '../../../../shared/ipc'
import { BasePalette } from './BasePalette'
import { usePlatform } from '@/hooks/usePlatform'

interface Command {
  id: string
  name: string
  description?: string
  icon: CommandIcon
  shortcut?: string[]
  action: () => void
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNewTab: (profileId?: string) => void
  onCloseTab: () => void
  onClearTab: () => void
  onCloseAllTabs: () => void
  onRestoreClosedTab: () => void
  onOpenSettings: () => void
  onOpenProjectPalette: () => void
  activeCwd: string | null
  profiles: Profile[]
}

export default function CommandPalette({
  open,
  onOpenChange,
  onNewTab,
  onCloseTab,
  onClearTab,
  onCloseAllTabs,
  onRestoreClosedTab,
  onOpenSettings,
  onOpenProjectPalette,
  activeCwd,
  profiles
}: CommandPaletteProps) {
  const { modSymbol } = usePlatform()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentCommandIds, setRecentCommandIds] = useState<string[]>([])

  // Load recent commands when palette opens
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      window.electronAPI.loadRecents().then((recents) => {
        setRecentCommandIds(recents.recentCommands)
      })
    }
  }, [open])

  const runGitOperation = useCallback(async (
    operation: () => Promise<GitOperationResult>,
    successMessage?: string
  ) => {
    if (!activeCwd) {
      toast.error('No active directory to run Git command')
      return
    }
    onOpenChange(false)
    try {
      const result = await operation()
      if (result.success) {
        toast.success(successMessage || result.message)
      } else {
        toast.error(result.error || result.message)
      }
    } catch (err) {
      toast.error((err as Error).message)
    }
  }, [activeCwd, onOpenChange])

  const commands: Command[] = useMemo(() => {
    const baseCommands: Command[] = [
      // Dynamically generate per-profile "new tab" commands
      ...profiles.map(profile => ({
        id: `new-tab-profile-${profile.id}`,
        name: `Tabs: New Tab with ${profile.name}`,
        description: `${profile.shell === 'system' ? 'System shell' : profile.shell} · ${profile.homeDirectory}`,
        icon: User as LucideIcon,
        shortcut: profile.id === 'default' ? [modSymbol, 'T'] : undefined,
        action: () => {
          onNewTab(profile.id)
          onOpenChange(false)
        }
      })),
      {
        id: 'open-profile-settings',
        name: 'Profiles: Open Profile Settings',
        description: 'Manage terminal profiles',
        icon: User as LucideIcon,
        action: () => {
          onOpenSettings()
          onOpenChange(false)
        }
      },
      {
        id: 'new-window',
        name: 'Window: New Window',
        description: 'Open a new Frostty window',
        icon: AppWindow as LucideIcon,
        shortcut: [modSymbol, '⇧', 'N'],
        action: () => {
          window.electronAPI.newWindow()
          onOpenChange(false)
        }
      },
      {
        id: 'close-window',
        name: 'Window: Close Window',
        description: 'Close the current window',
        icon: X,
        shortcut: [modSymbol, '⇧', 'W'],
        action: () => {
          window.electronAPI.closeWindow()
          onOpenChange(false)
        }
      },
      {
        id: 'restore-window',
        name: 'Window: Restore Last Window',
        description: 'Reopen the most recently closed window',
        icon: RotateCcw,
        action: () => {
          window.electronAPI.restoreLastWindow()
          onOpenChange(false)
        }
      },
      {
        id: 'close-tab',
        name: 'Tabs: Close Tab',
        description: 'Close the current terminal tab',
        icon: X,
        shortcut: [modSymbol, 'W'],
        action: () => {
          onCloseTab()
          onOpenChange(false)
        }
      },
      {
        id: 'close-all-tabs',
        name: 'Tabs: Close All Tabs',
        description: 'Close all terminal tabs',
        icon: XCircle,
        action: () => {
          onCloseAllTabs()
          onOpenChange(false)
        }
      },
      {
        id: 'restore-closed-tab',
        name: 'Tabs: Restore Closed Tab',
        description: 'Reopen the most recently closed tab',
        icon: RotateCcw,
        shortcut: [modSymbol, '⇧', 'T'],
        action: () => {
          onRestoreClosedTab()
          onOpenChange(false)
        }
      },
      {
        id: 'clear-tab',
        name: 'Tabs: Clear Tab',
        description: 'Clear the current terminal tab',
        icon: Eraser,
        shortcut: [modSymbol, 'L'],
        action: () => {
          onClearTab()
          onOpenChange(false)
        }
      },
      {
        id: 'open-project',
        name: 'Open Project',
        description: 'Open a git repository in a new tab',
        icon: FolderGit2,
        shortcut: [modSymbol, 'P'],
        action: () => {
          onOpenChange(false)
          onOpenProjectPalette()
        }
      },
      {
        id: 'open-settings',
        name: 'Settings',
        description: 'Configure defaults and preferences',
        icon: Settings,
        shortcut: [modSymbol, ','],
        action: () => {
          onOpenSettings()
          onOpenChange(false)
        }
      },
      {
        id: 'git-fetch',
        name: 'Git: Fetch',
        description: 'Fetch all remotes and prune',
        icon: RefreshCw,
        action: () => {
          void runGitOperation(
            () => window.electronAPI.gitFetch(activeCwd || ''),
            'Fetched all remotes'
          )
        }
      },
      {
        id: 'git-pull',
        name: 'Git: Pull',
        description: 'Pull from upstream for current branch',
        icon: Download,
        action: () => {
          void runGitOperation(() => window.electronAPI.gitPull(activeCwd || ''))
        }
      },
      {
        id: 'open-vscode',
        name: 'Editor: Open in VS Code',
        description: 'Open current directory in Visual Studio Code',
        icon: VSCodeIcon,
        shortcut: [modSymbol, '⇧', 'V'],
        action: async () => {
          if (!activeCwd) {
            toast.error('No active directory')
            return
          }
          onOpenChange(false)
          try {
            await window.electronAPI.openInVSCode(activeCwd)
            toast.success('Opened in VS Code')
          } catch (err) {
            toast.error('Failed to open in VS Code: ' + (err as Error).message)
          }
        }
      },
      {
        id: 'open-cursor',
        name: 'Editor: Open in Cursor',
        description: 'Open current directory in Cursor',
        icon: CursorIcon,
        shortcut: [modSymbol, '⇧', 'C'],
        action: async () => {
          if (!activeCwd) {
            toast.error('No active directory')
            return
          }
          onOpenChange(false)
          try {
            await window.electronAPI.openInCursor(activeCwd)
            toast.success('Opened in Cursor')
          } catch (err) {
            toast.error('Failed to open in Cursor: ' + (err as Error).message)
          }
        }
      }
    ]

    return baseCommands
  }, [onNewTab, onCloseTab, onClearTab, onCloseAllTabs, onRestoreClosedTab, onOpenSettings, onOpenProjectPalette, onOpenChange, runGitOperation, activeCwd, profiles, modSymbol])

  // Build display list with recent commands at top, separated from rest
  type DisplayItem = { type: 'command'; command: Command } | { type: 'separator' } | { type: 'heading'; label: string }

  const displayItems = useMemo((): DisplayItem[] => {
    let baseCommands = commands

    // Filter by query if present
    if (query.trim()) {
      const lowerQuery = query.toLowerCase()
      baseCommands = commands.filter(cmd =>
        cmd.name.toLowerCase().includes(lowerQuery) ||
        cmd.description?.toLowerCase().includes(lowerQuery)
      )
    }

    // Get recent commands that exist in our filtered list
    const recentCommands = recentCommandIds
      .map(id => baseCommands.find(cmd => cmd.id === id))
      .filter((cmd): cmd is Command => cmd !== undefined)

    // Get non-recent commands
    const recentIds = new Set(recentCommands.map(cmd => cmd.id))
    const otherCommands = baseCommands.filter(cmd => !recentIds.has(cmd.id))

    // Build display items
    const items: DisplayItem[] = []

    // Add recent heading and commands first
    if (recentCommands.length > 0) {
      items.push({ type: 'heading', label: 'Recent' })
      for (const command of recentCommands) {
        items.push({ type: 'command', command })
      }
    }

    // Add separator if we have both recent and other commands
    if (recentCommands.length > 0 && otherCommands.length > 0) {
      items.push({ type: 'separator' })
    }

    // Add other commands
    for (const command of otherCommands) {
      items.push({ type: 'command', command })
    }

    return items
  }, [commands, query, recentCommandIds])

  // Get only command items for navigation
  const commandItems = useMemo(() =>
    displayItems.filter((item): item is { type: 'command'; command: Command } => item.type === 'command'),
    [displayItems]
  )

  // Reset selection when display items change
  useEffect(() => {
    setSelectedIndex(0)
  }, [commandItems.length])

  // Scroll selected item into view
  useEffect(() => {
    const list = document.querySelector('[data-palette-list="commands"]')
    if (list) {
      const selectedElement = list.children[selectedIndex] as HTMLElement
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [selectedIndex])

  const executeCommand = useCallback((command: Command) => {
    window.electronAPI.saveRecentCommand(command.id).then(() => {
      window.electronAPI.loadRecents().then((recents) => {
        setRecentCommandIds(recents.recentCommands)
      })
    })
    command.action()
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev =>
          prev < commandItems.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : commandItems.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (commandItems[selectedIndex]) {
          executeCommand(commandItems[selectedIndex].command)
        }
        break
      case 'Escape':
        e.preventDefault()
        onOpenChange(false)
        break
    }
  }, [commandItems, selectedIndex, executeCommand, onOpenChange])

  return (
    <BasePalette
      open={open}
      onOpenChange={onOpenChange}
      title="Command Palette"
      searchPlaceholder="Type a command..."
      searchIcon={<Terminal className="w-4 h-4" />}
      query={query}
      onQueryChange={setQuery}
      itemCount={commandItems.length}
      enterLabel="Execute"
      emptyMessage={`No commands found for "${query}"`}
      onKeyDown={handleKeyDown}
    >
      <div data-palette-list="commands">
        {(() => {
          let commandIndex = -1
          return displayItems.map((item, itemIndex) => {
            if (item.type === 'heading') {
              return (
                <div
                  key={`heading-${itemIndex}`}
                  className="px-4 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                >
                  {item.label}
                </div>
              )
            }

            if (item.type === 'separator') {
              return (
                <div
                  key={`separator-${itemIndex}`}
                  className="py-2"
                >
                  <div className="h-px w-full bg-[hsl(220,15%,18%)]" />
                </div>
              )
            }

            commandIndex++
            const currentCommandIndex = commandIndex
            const command = item.command
            const Icon = command.icon
            const isSelected = currentCommandIndex === selectedIndex
            const isRecent = recentCommandIds.includes(command.id)

            return (
              <button
                key={command.id}
                onClick={() => executeCommand(command)}
                onMouseEnter={() => setSelectedIndex(currentCommandIndex)}
                className={cn(
                  'w-full px-4 py-3 flex items-center gap-3',
                  'transition-all duration-150 ease-out',
                  'text-left group cursor-pointer',
                  isSelected
                    ? 'bg-linear-to-r from-[hsl(210,100%,50%)]/15 to-transparent border-l-2 border-[hsl(210,100%,55%)]'
                    : 'border-l-2 border-transparent hover:bg-[hsl(220,15%,14%)]'
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center',
                    'transition-all duration-150',
                    isSelected
                      ? 'bg-[hsl(210,100%,55%)]/20 text-[hsl(210,100%,65%)]'
                      : 'bg-[hsl(220,15%,16%)] text-muted-foreground group-hover:text-foreground'
                  )}
                >
                  <Icon className="w-4 h-4" />
                </div>

                {/* Text content */}
                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      'text-sm font-medium truncate transition-colors duration-150 flex items-center gap-2',
                      isSelected ? 'text-foreground' : 'text-foreground/80 group-hover:text-foreground'
                    )}
                  >
                    {command.name}
                    {isRecent && (
                      <Clock className="w-3 h-3 text-muted-foreground opacity-60" />
                    )}
                  </div>
                  {command.description && (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {command.description}
                    </div>
                  )}
                </div>

                {/* Keyboard shortcut */}
                {command.shortcut && (
                  <div className="flex items-center gap-1">
                    {command.shortcut.map((key, i) => (
                      <Kbd
                        key={i}
                        className={cn(
                          'text-[10px] min-w-[22px] px-1.5',
                          isSelected
                            ? 'bg-[hsl(210,100%,55%)]/20 text-[hsl(210,100%,70%)]'
                            : 'bg-[hsl(220,15%,16%)] text-muted-foreground'
                        )}
                      >
                        {key}
                      </Kbd>
                    ))}
                  </div>
                )}
              </button>
            )
          })
        })()}
      </div>
    </BasePalette>
  )
}
