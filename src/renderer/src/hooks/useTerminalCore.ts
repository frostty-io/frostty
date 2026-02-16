import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { LigaturesAddon } from '@xterm/addon-ligatures'
import { WebglAddon } from '@xterm/addon-webgl'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SerializeAddon } from '@xterm/addon-serialize'
import { useAIMode } from './useAIMode'
import { TERMINAL_SCROLLBACK, TERMINAL_FIT_DELAY } from '../../../shared/constants'
// Import to ensure global Window type declarations are loaded
import '../../../shared/ipc'
import type { ShellType } from '../../../shared/ipc'

interface UseTerminalCoreOptions {
  tabId: string
  isActive: boolean
  modalOpen?: boolean
  initialCwd?: string
  initialContent?: string
  shell?: ShellType
  onShellReady?: (shell: string) => void
  // AI settings
  openRouterApiKey?: string
  openRouterModel?: string
  currentCwd?: string
}

// Global state to track spawned PTYs across hot reloads
const spawnedPtys = new Set<string>()

// Expose cleanup function globally so App can remove PTY from set on tab close
if (typeof window !== 'undefined') {
  window.__doggo_cleanup_pty = (tabId: string) => {
    spawnedPtys.delete(tabId)
  }
}

function safeDisposeWebglAddon(addon: WebglAddon | null): void {
  if (!addon) return
  try {
    addon.dispose()
  } catch (e) {
    console.warn('Error disposing WebGL addon:', e)
  }
}

export function useTerminalCore({
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
}: UseTerminalCoreOptions) {
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const webglAddonRef = useRef<WebglAddon | null>(null)
  const serializeAddonRef = useRef<SerializeAddon | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const isDisposedRef = useRef(false)
  const tabIdRef = useRef(tabId)
  const isActiveRef = useRef(isActive)
  const initialCwdRef = useRef(initialCwd)
  const initialContentRef = useRef(initialContent)
  const shellRef = useRef(shell)
  const onShellReadyRef = useRef(onShellReady)

  // Keep refs updated
  tabIdRef.current = tabId
  isActiveRef.current = isActive
  initialCwdRef.current = initialCwd
  shellRef.current = shell
  onShellReadyRef.current = onShellReady

  // AI mode hook
  const { enterAIMode, handleAIInput, aiStateRef } = useAIMode({
    terminalRef,
    tabIdRef,
    shellRef,
    openRouterApiKey,
    openRouterModel,
    currentCwd
  })

  // Initialize terminal on container mount - stable callback
  const setContainerRef = useCallback(
    (container: HTMLDivElement | null) => {
      if (!container) return
      if (containerRef.current === container) return
      containerRef.current = container

      // Don't reinitialize if already set up
      if (terminalRef.current) return

      const terminal = new Terminal({
        cursorBlink: true,
        cursorStyle: 'block',
        fontSize: 12,
        fontFamily: 'Doggo Terminal Nerd Mono',
        lineHeight: 1.2,
        scrollback: TERMINAL_SCROLLBACK,
        allowProposedApi: true,
        customGlyphs: true,
        rescaleOverlappingGlyphs: true,

        theme: {
          background: '#1a1b26',
          foreground: '#c0caf5',
          cursor: '#c0caf5',
          cursorAccent: '#1a1b26',
          selectionBackground: '#33467c',
          selectionForeground: '#c0caf5',
          black: '#15161e',
          red: '#f7768e',
          green: '#9ece6a',
          yellow: '#e0af68',
          blue: '#7aa2f7',
          magenta: '#bb9af7',
          cyan: '#7dcfff',
          white: '#a9b1d6',
          brightBlack: '#414868',
          brightRed: '#f7768e',
          brightGreen: '#9ece6a',
          brightYellow: '#e0af68',
          brightBlue: '#7aa2f7',
          brightMagenta: '#bb9af7',
          brightCyan: '#7dcfff',
          brightWhite: '#c0caf5'
        }
      })

      const fitAddon = new FitAddon()
      terminal.loadAddon(fitAddon)
      terminal.open(container)

      terminalRef.current = terminal
      fitAddonRef.current = fitAddon

      // Load Unicode11 addon for better unicode character width detection
      const unicode11Addon = new Unicode11Addon()
      terminal.loadAddon(unicode11Addon)
      terminal.unicode.activeVersion = '11'

      // Load ligatures addon so supported fonts can render ligatures correctly
      const ligaturesAddon = new LigaturesAddon()
      terminal.loadAddon(ligaturesAddon)

      // Load WebLinks addon to make URLs clickable
      const webLinksAddon = new WebLinksAddon()
      terminal.loadAddon(webLinksAddon)

      // Load Serialize addon for session persistence
      const serializeAddon = new SerializeAddon()
      terminal.loadAddon(serializeAddon)
      serializeAddonRef.current = serializeAddon

      // Load WebGL addon for better performance
      try {
        const webglAddon = new WebglAddon()
        webglAddon.onContextLoss(() => {
          // Force fallback to non-WebGL renderer after context loss.
          if (webglAddonRef.current === webglAddon) {
            webglAddonRef.current = null
          }
          safeDisposeWebglAddon(webglAddon)
          console.warn('WebGL context lost; fell back to canvas renderer')
        })
        terminal.loadAddon(webglAddon)
        webglAddonRef.current = webglAddon
      } catch (e) {
        console.warn('WebGL addon failed to load, falling back to canvas renderer:', e)
      }

      // Fit after a short delay to ensure container has dimensions
      setTimeout(() => {
        if (fitAddonRef.current && terminalRef.current && !isDisposedRef.current) {
          fitAddonRef.current.fit()
          const { cols, rows } = terminalRef.current
          window.electronAPI.resizePty(tabIdRef.current, cols, rows)
        }
      }, TERMINAL_FIT_DELAY)

      // Wire up input to PTY (with AI mode interception)
      terminal.onData((data) => {
        if (isDisposedRef.current) return

        // If in AI mode, handle input locally
        if (aiStateRef.current !== 'idle') {
          handleAIInput(data)
          return
        }

        // Normal mode: send to PTY
        window.electronAPI.writePty(tabIdRef.current, data)
      })

      // Restore scrollback content from previous session (before spawning PTY)
      setTimeout(() => {
        if (initialContentRef.current) {
          terminal.write(initialContentRef.current)
          initialContentRef.current = undefined // Only restore once
        }
      }, TERMINAL_FIT_DELAY)

      // Spawn PTY only if not already spawned (check global set)
      if (!spawnedPtys.has(tabIdRef.current)) {
        spawnedPtys.add(tabIdRef.current)
        window.electronAPI
          .spawnPty(tabIdRef.current, initialCwdRef.current, shellRef.current)
          .then((response) => {
            if (onShellReadyRef.current) {
              onShellReadyRef.current(response.shell)
            }
          })
      }

      // Focus if active
      if (isActiveRef.current) {
        terminal.focus()
      }
    },
    [handleAIInput, aiStateRef]
  )

  // Handle PTY data
  useEffect(() => {
    const unsubscribe = window.electronAPI.onPtyData((event) => {
      if (event.tabId === tabId && terminalRef.current && !isDisposedRef.current) {
        terminalRef.current.write(event.data)
      }
    })
    return unsubscribe
  }, [tabId])

  // Handle PTY exit
  useEffect(() => {
    const unsubscribe = window.electronAPI.onPtyExit((event) => {
      if (event.tabId === tabId && terminalRef.current && !isDisposedRef.current) {
        terminalRef.current.write(`\r\n[Process exited with code ${event.exitCode}]`)
      }
    })
    return unsubscribe
  }, [tabId])

  // Focus and resize when becoming active or when modal closes
  useEffect(() => {
    if (isActive && !modalOpen && terminalRef.current && fitAddonRef.current && !isDisposedRef.current) {
      terminalRef.current.focus()

      setTimeout(() => {
        if (fitAddonRef.current && terminalRef.current && !isDisposedRef.current) {
          fitAddonRef.current.fit()
          const { cols, rows } = terminalRef.current
          window.electronAPI.resizePty(tabId, cols, rows)
        }
      }, 50)
    }
  }, [isActive, modalOpen, tabId])

  // Set up resize observer (150ms trailing debounce to coalesce rapid resize events)
  const resizeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const RESIZE_DEBOUNCE_MS = 150
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current && terminalRef.current && !isDisposedRef.current) {
        if (resizeDebounceRef.current) clearTimeout(resizeDebounceRef.current)
        resizeDebounceRef.current = setTimeout(() => {
          resizeDebounceRef.current = null
          if (fitAddonRef.current && terminalRef.current && !isDisposedRef.current) {
            fitAddonRef.current.fit()
            const { cols, rows } = terminalRef.current
            window.electronAPI.resizePty(tabIdRef.current, cols, rows)
          }
        }, RESIZE_DEBOUNCE_MS)
      }
    })

    resizeObserver.observe(container)
    return () => {
      if (resizeDebounceRef.current) {
        clearTimeout(resizeDebounceRef.current)
        resizeDebounceRef.current = null
      }
      resizeObserver.disconnect()
    }
  }, [])

  // Cleanup on unmount - dispose terminal but keep PTY alive
  useEffect(() => {
    return () => {
      isDisposedRef.current = true

      // Dispose WebGL addon first (before terminal)
      const webglAddon = webglAddonRef.current
      webglAddonRef.current = null
      safeDisposeWebglAddon(webglAddon)

      // Then dispose the terminal
      if (terminalRef.current) {
        try {
          terminalRef.current.dispose()
        } catch (e) {
          console.warn('Error disposing terminal:', e)
        }
        terminalRef.current = null
      }
    }
  }, [])

  // Serialize terminal buffer for session persistence
  const serialize = useCallback((): string => {
    if (serializeAddonRef.current && terminalRef.current && !isDisposedRef.current) {
      try {
        return serializeAddonRef.current.serialize()
      } catch (e) {
        console.warn('Failed to serialize terminal:', e)
      }
    }
    return ''
  }, [])

  // Clear terminal screen (scrollback and viewport)
  const clear = useCallback(() => {
    if (terminalRef.current && !isDisposedRef.current) {
      terminalRef.current.clear()
    }
  }, [])

  return { setContainerRef, enterAIMode, serialize, clear }
}
