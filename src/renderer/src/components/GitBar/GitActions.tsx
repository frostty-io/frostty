import { RefreshCw, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { Kbd } from '@/components/ui/kbd'
import { VSCodeIcon, CursorIcon } from '@/components/icons'
import { usePlatform } from '@/hooks/usePlatform'
import { getShortcutDisplay } from '@/lib/shortcutRegistry'
import type { GitStatus } from '@shared/ipc'

export type OperationState = 'idle' | 'loading' | 'success' | 'error'

interface GitActionsProps {
  cwd: string
  status: GitStatus
  operationState: OperationState
  onFetch: () => void
  onPull: () => void
  onOpenInVSCode: () => void
  onOpenInCursor: () => void
}

export default function GitActions({
  status,
  operationState,
  onFetch,
  onPull,
  onOpenInVSCode,
  onOpenInCursor
}: GitActionsProps) {
  const { isMac } = usePlatform()
  const needsPull = status.behind > 0
  const isLoading = operationState === 'loading'
  const openInVSCodeShortcut = getShortcutDisplay('openVSCode', isMac).join('+')
  const openInCursorShortcut = getShortcutDisplay('openCursor', isMac).join('+')

  return (
    <div className="flex items-center gap-1 ml-auto">
      {/* Editor buttons */}
      <TooltipProvider delayDuration={300}>
        <div className="flex items-center rounded-md border border-white/10 overflow-hidden">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenInVSCode}
                disabled={isLoading}
                className="h-7 px-2 rounded-none hover:bg-white/5 text-muted-foreground hover:text-[#007ACC] transition-colors"
              >
                <VSCodeIcon className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="flex items-center gap-2 border-white/10">
              <span>Open in VS Code</span>
              <Kbd>{openInVSCodeShortcut}</Kbd>
            </TooltipContent>
          </Tooltip>

          <div className="w-px h-4 bg-white/10" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenInCursor}
                disabled={isLoading}
                className="h-7 px-2 rounded-none hover:bg-white/5 text-muted-foreground hover:text-white transition-colors"
              >
                <CursorIcon className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="flex items-center gap-2 border-white/10">
              <span>Open in Cursor</span>
              <Kbd>{openInCursorShortcut}</Kbd>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      <div className="w-px h-5 bg-white/10 mx-1" />

      {/* Fetch */}
      <button
        onClick={onFetch}
        disabled={isLoading}
        className="p-1.5 rounded-md hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
        title="Fetch all"
      >
        <RefreshCw className="w-3.5 h-3.5" />
      </button>

      {/* Pull */}
      <button
        onClick={onPull}
        disabled={!status.upstream || isLoading}
        className={`p-1.5 rounded-md transition-colors ${
          needsPull
            ? 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20'
            : 'hover:bg-white/5 text-muted-foreground hover:text-foreground disabled:opacity-30'
        }`}
        title="Pull"
      >
        <Download className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
