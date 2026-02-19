import { memo, useEffect } from 'react'
import { useTerminalCore } from '../hooks/useTerminalCore'
import { useTabStore } from '../stores/useTabStore'
import '@xterm/xterm/css/xterm.css'
import type { ShellType } from '../../../shared/ipc'

interface TerminalProps {
  tabId: string
  isActive: boolean
  fontSize: number
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

function Terminal({
  tabId,
  isActive,
  fontSize,
  modalOpen,
  initialCwd,
  initialContent,
  shell,
  onShellReady,
  onFocus,
  openRouterApiKey,
  openRouterModel,
  currentCwd
}: TerminalProps) {
  const { setContainerRef, enterAIMode, serialize, clear } = useTerminalCore({
    tabId,
    isActive,
    fontSize,
    modalOpen,
    initialCwd,
    initialContent,
    shell,
    onShellReady,
    openRouterApiKey,
    openRouterModel,
    currentCwd
  })

  useEffect(() => {
    useTabStore.getState().setTerminalRef(tabId, { enterAIMode, serialize, clear })
    return () => {
      useTabStore.getState().setTerminalRef(tabId, null)
    }
  }, [tabId, enterAIMode, serialize, clear])

  return (
    <div className="absolute inset-3 right-0">
      <div
        ref={setContainerRef}
        className="bg-primary absolute inset-0"
        onMouseDown={onFocus}
      />
    </div>
  )
}

const MemoizedTerminal = memo(Terminal)
MemoizedTerminal.displayName = 'Terminal'
export default MemoizedTerminal
