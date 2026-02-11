import { useRef, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog'
import { Kbd } from '../ui/kbd'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

export interface BasePaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string  // sr-only accessibility title
  searchPlaceholder: string
  searchIcon: React.ReactNode
  query: string
  onQueryChange: (query: string) => void
  itemCount: number
  enterLabel?: string  // "Execute" or "Open"
  children: React.ReactNode  // The list content
  onKeyDown?: (e: React.KeyboardEvent) => void
  emptyMessage?: string
  loading?: boolean
  loadingMessage?: string
}

export function BasePalette({
  open,
  onOpenChange,
  title,
  searchPlaceholder,
  searchIcon,
  query,
  onQueryChange,
  itemCount,
  enterLabel = 'Execute',
  children,
  onKeyDown,
  emptyMessage,
  loading,
  loadingMessage = 'Loading...'
}: BasePaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when palette opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'fixed top-[12%] left-1/2 -translate-x-1/2 translate-y-0',
          'w-full max-w-[560px] p-0 gap-0 overflow-hidden',
          'bg-gradient-to-b from-[hsl(220,15%,12%)] to-[hsl(220,15%,9%)]',
          'border border-[hsl(220,15%,20%)] shadow-2xl shadow-black/50',
          'rounded-xl backdrop-blur-xl',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
          'data-[state=open]:slide-in-from-top-4 data-[state=closed]:slide-out-to-top-2',
          'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
          '[&>button:last-child]:hidden' // Hide default close button
        )}
        onKeyDown={onKeyDown}
      >
        {/* Hidden title for accessibility */}
        <DialogTitle className="sr-only">{title}</DialogTitle>

        {/* Search Input */}
        <div className="relative border-b border-[hsl(220,15%,18%)]">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
            {searchIcon}
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={searchPlaceholder}
            className={cn(
              'w-full h-14 pl-11 pr-4 bg-transparent',
              'text-foreground placeholder:text-muted-foreground',
              'outline-none border-0 focus:ring-0',
              'text-sm font-regular tracking-wide'
            )}
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            <Kbd className="text-[10px] bg-[hsl(220,15%,16%)]">ESC</Kbd>
          </div>
        </div>

        {/* List content */}
        <div className="max-h-[320px] overflow-y-auto py-2 scroll-smooth">
          {loading ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {loadingMessage}
            </div>
          ) : itemCount === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              {emptyMessage || 'No results found'}
            </div>
          ) : (
            children
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-[hsl(220,15%,18%)] bg-[hsl(220,15%,8%)]">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <Kbd className="bg-[hsl(220,15%,14%)]">↑</Kbd>
                <Kbd className="bg-[hsl(220,15%,14%)]">↓</Kbd>
                <span>Navigate</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd className="bg-[hsl(220,15%,14%)]">↵</Kbd>
                <span>{enterLabel}</span>
              </span>
            </div>
            <span className="opacity-60">
              {itemCount} item{itemCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
