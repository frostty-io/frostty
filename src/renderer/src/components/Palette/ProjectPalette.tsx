import { useState, useEffect, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { FolderGit2, Clock } from 'lucide-react'
import type { GitRepoInfo } from '../../../../shared/ipc'
import { BasePalette } from './BasePalette'

interface ProjectPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectProject: (path: string) => void
  repos: GitRepoInfo[]
  loading: boolean
}

export default function ProjectPalette({
  open,
  onOpenChange,
  onSelectProject,
  repos,
  loading
}: ProjectPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentProjectPaths, setRecentProjectPaths] = useState<string[]>([])

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      window.electronAPI.loadRecents().then((recents) => {
        setRecentProjectPaths(recents.recentProjects)
      })
    }
  }, [open])

  // Build display list with recent projects at top, separated from rest
  type DisplayItem = { type: 'project'; repo: GitRepoInfo } | { type: 'separator' } | { type: 'heading'; label: string }

  const displayItems = useMemo((): DisplayItem[] => {
    let baseRepos = repos

    // Filter by query if present
    if (query.trim()) {
      const lowerQuery = query.toLowerCase()
      baseRepos = repos.filter(repo =>
        repo.name.toLowerCase().includes(lowerQuery) ||
        repo.path.toLowerCase().includes(lowerQuery)
      )
    }

    // Get recent projects that exist in our filtered list
    const recentRepos = recentProjectPaths
      .map(path => baseRepos.find(repo => repo.path === path))
      .filter((repo): repo is GitRepoInfo => repo !== undefined)

    // Get non-recent projects
    const recentPaths = new Set(recentRepos.map(repo => repo.path))
    const otherRepos = baseRepos.filter(repo => !recentPaths.has(repo.path))

    // Build display items
    const items: DisplayItem[] = []

    // Add recent heading and projects first
    if (recentRepos.length > 0) {
      items.push({ type: 'heading', label: 'Recent' })
      for (const repo of recentRepos) {
        items.push({ type: 'project', repo })
      }
    }

    // Add separator if we have both recent and other projects
    if (recentRepos.length > 0 && otherRepos.length > 0) {
      items.push({ type: 'separator' })
    }

    // Add other projects
    for (const repo of otherRepos) {
      items.push({ type: 'project', repo })
    }

    return items
  }, [repos, query, recentProjectPaths])

  // Get only project items for navigation
  const projectItems = useMemo(() =>
    displayItems.filter((item): item is { type: 'project'; repo: GitRepoInfo } => item.type === 'project'),
    [displayItems]
  )

  // Reset selection when display items change
  useEffect(() => {
    setSelectedIndex(0)
  }, [projectItems.length])

  // Scroll selected item into view
  useEffect(() => {
    const list = document.querySelector('[data-palette-list="projects"]')
    if (list) {
      const selectedElement = list.children[selectedIndex] as HTMLElement
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [selectedIndex])

  const selectRepo = useCallback((repo: GitRepoInfo) => {
    window.electronAPI.saveRecentProject(repo.path).then(() => {
      window.electronAPI.loadRecents().then((recents) => {
        setRecentProjectPaths(recents.recentProjects)
      })
    })
    onSelectProject(repo.path)
    onOpenChange(false)
  }, [onSelectProject, onOpenChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev =>
          prev < projectItems.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : projectItems.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (projectItems[selectedIndex]) {
          selectRepo(projectItems[selectedIndex].repo)
        }
        break
      case 'Escape':
        e.preventDefault()
        onOpenChange(false)
        break
    }
  }, [projectItems, selectedIndex, selectRepo, onOpenChange])

  // Shorten path for display – try Unix-style home replacements unconditionally
  // (they won't match on Windows paths anyway)
  const shortenPath = (path: string): string => {
    return path.replace(/^\/Users\/[^/]+/, '~').replace(/^\/home\/[^/]+/, '~')
  }

  return (
    <BasePalette
      open={open}
      onOpenChange={onOpenChange}
      title="Open Project"
      searchPlaceholder="Search projects..."
      searchIcon={<FolderGit2 className="w-4 h-4" />}
      query={query}
      onQueryChange={setQuery}
      itemCount={projectItems.length}
      enterLabel="Open"
      emptyMessage={query ? `No projects found for "${query}"` : 'No git repositories found'}
      loading={loading}
      loadingMessage="Scanning for projects..."
      onKeyDown={handleKeyDown}
    >
      <div data-palette-list="projects">
        {(() => {
          let projectIndex = -1
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

            projectIndex++
            const currentProjectIndex = projectIndex
            const repo = item.repo
            const isSelected = currentProjectIndex === selectedIndex
            const isRecent = recentProjectPaths.includes(repo.path)

            return (
              <button
                key={repo.path}
                onClick={() => selectRepo(repo)}
                onMouseEnter={() => setSelectedIndex(currentProjectIndex)}
                className={cn(
                  'w-full px-4 py-3 flex items-center gap-3',
                  'transition-all duration-150 ease-out',
                  'text-left group cursor-pointer',
                  isSelected
                    ? 'bg-linear-to-r from-[hsl(150,60%,40%)]/15 to-transparent border-l-2 border-[hsl(150,60%,45%)]'
                    : 'border-l-2 border-transparent hover:bg-[hsl(220,15%,14%)]'
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center',
                    'transition-all duration-150',
                    isSelected
                      ? 'bg-[hsl(150,60%,45%)]/20 text-[hsl(150,60%,55%)]'
                      : 'bg-[hsl(220,15%,16%)] text-muted-foreground group-hover:text-foreground'
                  )}
                >
                  <FolderGit2 className="w-4 h-4" />
                </div>

                {/* Text content */}
                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      'text-sm font-medium truncate transition-colors duration-150 flex items-center gap-2',
                      isSelected ? 'text-foreground' : 'text-foreground/80 group-hover:text-foreground'
                    )}
                  >
                    {repo.name}
                    {isRecent && (
                      <Clock className="w-3 h-3 text-muted-foreground opacity-60" />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">
                    {shortenPath(repo.path)}
                  </div>
                </div>
              </button>
            )
          })
        })()}
      </div>
    </BasePalette>
  )
}
