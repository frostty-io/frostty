import { forwardRef, useImperativeHandle, memo } from 'react'
import { useTerminalCore } from '../hooks/useTerminalCore'
import '@xterm/xterm/css/xterm.css'
import type { ShellType } from '../../../shared/ipc'

interface TerminalProps {
  tabId: string
  isActive: boolean
  modalOpen?: boolean
  initialCwd?: string
  initialContent?: string
  shell?: ShellType
  onShellReady?: (shell: string) => void
  onFocus?: () => void
  // AI settings
  openRouterApiKey?: string
  openRouterModel?: string
  currentCwd?: string
}

export interface TerminalHandle {
  enterAIMode: () => void
  serialize: () => string
  clear: () => void
}

const Terminal = forwardRef<TerminalHandle, TerminalProps>(function Terminal(
  { tabId, isActive, modalOpen, initialCwd, initialContent, shell, onShellReady, onFocus, openRouterApiKey, openRouterModel, currentCwd },
  ref
) {
  const { setContainerRef, enterAIMode, serialize, clear } = useTerminalCore({
    tabId,
    isActive,
    modalOpen,
    initialCwd,
    initialContent,
    shell,
    onShellReady,
    openRouterApiKey,
    openRouterModel,
    currentCwd
  })

  // Expose enterAIMode, serialize, and clear to parent via ref
  useImperativeHandle(ref, () => ({
    enterAIMode,
    serialize,
    clear
  }), [enterAIMode, serialize, clear])

  return (
    <div className="absolute inset-3 right-0">
    <div
      ref={setContainerRef}
      className="bg-primary absolute inset-0"
      onMouseDown={onFocus}
    />
    </div>
  )
})

const MemoizedTerminal = memo(Terminal)
MemoizedTerminal.displayName = 'Terminal'
export default MemoizedTerminal
