import { Search, X, ArrowUp, ArrowDown, Settings, FolderGit2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import frosttyLogo from '@resources/logo.png'
import frosttyCanaryLogo from '@resources/logo_canary.png'
import { usePlatform } from '@/hooks/usePlatform'
import { getRuntimeLogoFilename } from '../../../shared/releaseChannel'

interface KeyboardShortcut {
  label: string
  keys: string[]
  icon: React.ReactNode
}

function KeyCap({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 text-xs font-medium text-muted-foreground bg-[hsl(220,15%,12%)] border border-[hsl(220,15%,20%)] rounded-md shadow-[0_2px_0_0_hsl(220,15%,8%),inset_0_1px_0_0_hsl(220,15%,16%)]">
      {children}
    </kbd>
  )
}

function ShortcutRow({ shortcut }: { shortcut: KeyboardShortcut }) {
  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-[hsl(220,15%,12%)] transition-colors group">
      <div className="flex items-center gap-3 text-muted-foreground group-hover:text-foreground transition-colors">
        <span className="opacity-60 group-hover:opacity-100 transition-opacity">
          {shortcut.icon}
        </span>
        <span className="text-sm font-medium">{shortcut.label}</span>
      </div>
      <div className="flex items-center gap-1">
        {shortcut.keys.map((key, index) => (
          <KeyCap key={index}>{key}</KeyCap>
        ))}
      </div>
    </div>
  )
}

export default function EmptyState() {
  const { modSymbol } = usePlatform()
  const [visible, setVisible] = useState(false)
  const logoSrc = getRuntimeLogoFilename(__FROSTTY_RELEASE_CHANNEL__) === 'logo_canary.png'
    ? frosttyCanaryLogo
    : frosttyLogo

  const shortcuts: KeyboardShortcut[] = useMemo(() => [
    {
      label: 'Command Palette',
      keys: [modSymbol, 'Shift', 'P'],
      icon: <Search className="w-4 h-4" />,
    },
    {
      label: 'Project Palette',
      keys: [modSymbol, 'P'],
      icon: <FolderGit2 className="w-4 h-4" />,
    },
    {
      label: 'Settings',
      keys: [modSymbol, ','],
      icon: <Settings className="w-4 h-4" />,
    },
    {
      label: 'Close Tab',
      keys: [modSymbol, 'W'],
      icon: <X className="w-4 h-4" />,
    },
    {
      label: 'Previous Tab',
      keys: [modSymbol, '↑'],
      icon: <ArrowUp className="w-4 h-4" />,
    },
    {
      label: 'Next Tab',
      keys: [modSymbol, '↓'],
      icon: <ArrowDown className="w-4 h-4" />,
    },
  ], [modSymbol])

  // Fade in animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      className={`flex items-center justify-center h-full transition-all duration-500 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <div className="flex flex-col items-center gap-8 max-w-sm w-full">
        {/* Logo with soft glow */}
        <div className="relative flex items-center justify-center">
          {/* Radial gradient glow */}
          <div
            className="absolute w-96 h-96 rounded-full opacity-25"
            style={{
              background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 40%, transparent 70%)',
            }}
          />

          {/* Logo */}
          <img
            src={logoSrc}
            alt="Frostty"
            className="relative w-24 h-24 grayscale opacity-50"
            draggable={false}
          />
        </div>

        {/* Shortcuts list */}
        <div className="w-full bg-[hsl(220,15%,10%)]/50 border border-[hsl(220,15%,16%)] rounded-xl p-2 backdrop-blur-sm">
          {shortcuts.map((shortcut, index) => (
            <ShortcutRow key={index} shortcut={shortcut} />
          ))}
        </div>

        {/* Subtle hint text */}
        <p className="text-xs text-muted-foreground/50 text-center">
          Press any shortcut to get started
        </p>
      </div>
    </div>
  )
}
