import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { LigaturesAddon } from '@xterm/addon-ligatures'
import { WebglAddon } from '@xterm/addon-webgl'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SerializeAddon } from '@xterm/addon-serialize'
import { useAIMode } from './useAIMode'
import { isMacPlatform } from '@/lib/shortcutRegistry'
import { translateTerminalKey } from '@/lib/terminalKeyTranslation'
import {
  TERMINAL_SCROLLBACK,
  TERMINAL_FIT_DELAY,
  TERMINAL_FONT_SIZE_DEFAULT
} from '../../../shared/constants'
// Import to ensure global Window type declarations are loaded
import '../../../shared/ipc'
import type { ShellType } from '../../../shared/ipc'

interface UseTerminalCoreOptions {
  tabId: string
  isActive: boolean
  fontSize?: number
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
const TERMINAL_FONT_FAMILY = 'Frostty Terminal Nerd Mono'
let terminalFontReadyPromise: Promise<void> | null = null

interface BufferCursorPosition {
  x: number
  y: number
}

type WordDirection = 'left' | 'right'

interface BufferTextMapping {
  text: string
  offsetToPosition: BufferCursorPosition[]
}

function getBufferCursorPosition(terminal: Terminal): BufferCursorPosition {
  const buffer = terminal.buffer.active
  return {
    x: buffer.cursorX,
    y: buffer.baseY + buffer.cursorY
  }
}

function cloneBufferPosition(position: BufferCursorPosition): BufferCursorPosition {
  return { x: position.x, y: position.y }
}

function compareBufferPositions(a: BufferCursorPosition, b: BufferCursorPosition): number {
  if (a.y !== b.y) return a.y - b.y
  return a.x - b.x
}

function clampBufferPosition(
  position: BufferCursorPosition,
  min: BufferCursorPosition,
  max: BufferCursorPosition
): BufferCursorPosition {
  if (compareBufferPositions(position, min) < 0) return cloneBufferPosition(min)
  if (compareBufferPositions(position, max) > 0) return cloneBufferPosition(max)
  return cloneBufferPosition(position)
}

function getBufferCellChar(terminal: Terminal, row: number, col: number): string {
  const line = terminal.buffer.active.getLine(row)
  if (!line) return ' '
  const chars = line.getCell(col)?.getChars() ?? ''
  return chars.length > 0 ? chars : ' '
}

function getLogicalLineEndColumn(terminal: Terminal, row: number): number {
  const line = terminal.buffer.active.getLine(row)
  if (!line) return 0

  const nextLine = terminal.buffer.active.getLine(row + 1)
  if (nextLine?.isWrapped) return terminal.cols
  return line.translateToString(true).length
}

function inferEditableStartFromWrappedBlock(
  terminal: Terminal,
  cursor: BufferCursorPosition
): BufferCursorPosition {
  let row = cursor.y
  while (row > 0 && terminal.buffer.active.getLine(row)?.isWrapped) {
    row--
  }
  return { x: 0, y: row }
}

function inferEditableEndFromWrappedBlock(
  terminal: Terminal,
  cursor: BufferCursorPosition
): BufferCursorPosition {
  let row = cursor.y
  while (terminal.buffer.active.getLine(row + 1)?.isWrapped) {
    row++
  }
  return { x: getLogicalLineEndColumn(terminal, row), y: row }
}

function buildBufferTextMapping(
  terminal: Terminal,
  min: BufferCursorPosition,
  max: BufferCursorPosition
): BufferTextMapping {
  const start = compareBufferPositions(min, max) <= 0 ? min : max
  const end = compareBufferPositions(min, max) <= 0 ? max : min
  const parts: string[] = []
  const offsetToPosition: BufferCursorPosition[] = [cloneBufferPosition(start)]

  for (let row = start.y; row <= end.y; row++) {
    const rowStart = row === start.y ? start.x : 0
    const rowEnd = row === end.y ? end.x : getLogicalLineEndColumn(terminal, row)

    for (let col = rowStart; col < rowEnd; col++) {
      parts.push(getBufferCellChar(terminal, row, col))
      offsetToPosition.push({ x: col + 1, y: row })
    }

    if (row < end.y && !terminal.buffer.active.getLine(row + 1)?.isWrapped) {
      parts.push('\n')
      offsetToPosition.push({ x: 0, y: row + 1 })
    }
  }

  return { text: parts.join(''), offsetToPosition }
}

function findOffsetForPosition(
  offsetToPosition: BufferCursorPosition[],
  position: BufferCursorPosition
): number {
  let lastBefore = 0
  for (let i = 0; i < offsetToPosition.length; i++) {
    const cmp = compareBufferPositions(offsetToPosition[i], position)
    if (cmp === 0) return i
    if (cmp > 0) return Math.max(0, i - 1)
    lastBefore = i
  }
  return lastBefore
}

function isWordChar(char: string): boolean {
  return /[A-Za-z0-9_]/.test(char)
}

function moveWordLeft(text: string, cursor: number): number {
  if (cursor <= 0) return 0
  let pos = Math.min(cursor - 1, Math.max(0, text.length - 1))

  while (pos > 0 && !isWordChar(text[pos])) {
    pos--
  }
  while (pos > 0 && isWordChar(text[pos - 1])) {
    pos--
  }

  return pos
}

function moveWordRight(text: string, cursor: number): number {
  const len = text.length
  if (cursor >= len) return len

  let pos = cursor
  while (pos < len && isWordChar(text[pos])) {
    pos++
  }
  while (pos < len && !isWordChar(text[pos])) {
    pos++
  }
  return pos
}

function applyKeyboardSelection(
  terminal: Terminal,
  anchor: BufferCursorPosition,
  focus: BufferCursorPosition
): void {
  const start = compareBufferPositions(anchor, focus) <= 0 ? anchor : focus
  const end = compareBufferPositions(anchor, focus) <= 0 ? focus : anchor
  const length = (end.y - start.y) * terminal.cols + (end.x - start.x)
  if (length === 0) {
    terminal.clearSelection()
    return
  }
  terminal.select(start.x, start.y, length)
}

function moveFocusByWord(
  terminal: Terminal,
  focus: BufferCursorPosition,
  direction: WordDirection,
  minBoundary: BufferCursorPosition,
  maxBoundary: BufferCursorPosition
): BufferCursorPosition {
  const min = compareBufferPositions(minBoundary, maxBoundary) <= 0 ? minBoundary : maxBoundary
  const max = compareBufferPositions(minBoundary, maxBoundary) <= 0 ? maxBoundary : minBoundary
  const clampedFocus = clampBufferPosition(focus, min, max)
  const mapping = buildBufferTextMapping(terminal, min, max)
  const focusOffset = findOffsetForPosition(mapping.offsetToPosition, clampedFocus)
  const nextOffset = direction === 'left'
    ? moveWordLeft(mapping.text, focusOffset)
    : moveWordRight(mapping.text, focusOffset)

  return mapping.offsetToPosition[nextOffset] ?? clampedFocus
}

function ensureTerminalFontReady(): Promise<void> {
  if (!terminalFontReadyPromise) {
    terminalFontReadyPromise = (async () => {
      if (typeof document === 'undefined' || !('fonts' in document)) return

      try {
        await Promise.all([
          document.fonts.load(`400 ${TERMINAL_FONT_SIZE_DEFAULT}px "${TERMINAL_FONT_FAMILY}"`),
          document.fonts.load(`700 ${TERMINAL_FONT_SIZE_DEFAULT}px "${TERMINAL_FONT_FAMILY}"`),
          document.fonts.load(`italic 400 ${TERMINAL_FONT_SIZE_DEFAULT}px "${TERMINAL_FONT_FAMILY}"`),
          document.fonts.load(`italic 700 ${TERMINAL_FONT_SIZE_DEFAULT}px "${TERMINAL_FONT_FAMILY}"`)
        ])
        await document.fonts.ready
      } catch (e) {
        console.warn('Terminal font preload failed; using fallback metrics:', e)
      }
    })()
  }

  return terminalFontReadyPromise
}

// Expose cleanup function globally so App can remove PTY from set on tab close
if (typeof window !== 'undefined') {
  window.__frostty_cleanup_pty = (tabId: string) => {
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
  fontSize = TERMINAL_FONT_SIZE_DEFAULT,
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
  const fontSizeRef = useRef(fontSize)
  const isInitializingRef = useRef(false)
  const keyboardSelectionAnchorRef = useRef<BufferCursorPosition | null>(null)
  const keyboardSelectionFocusRef = useRef<BufferCursorPosition | null>(null)
  const keyboardSelectionMinRef = useRef<BufferCursorPosition | null>(null)
  const keyboardSelectionMaxRef = useRef<BufferCursorPosition | null>(null)
  const editableInputStartRef = useRef<BufferCursorPosition | null>(null)
  const hasUserInputForPromptRef = useRef(false)

  // Keep refs updated
  tabIdRef.current = tabId
  isActiveRef.current = isActive
  initialCwdRef.current = initialCwd
  shellRef.current = shell
  onShellReadyRef.current = onShellReady
  fontSizeRef.current = fontSize

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
      if (isInitializingRef.current) return
      isInitializingRef.current = true

      void (async () => {
        await ensureTerminalFontReady()
        if (isDisposedRef.current || !containerRef.current) return
        const isMac = typeof navigator !== 'undefined' && isMacPlatform(navigator.platform)

        const terminal = new Terminal({
          cursorBlink: true,
          cursorStyle: 'block',
          fontSize: fontSizeRef.current,
          fontFamily: TERMINAL_FONT_FAMILY,
          lineHeight: 1.2,
          scrollback: TERMINAL_SCROLLBACK,
          allowProposedApi: true,
          customGlyphs: true,
          rescaleOverlappingGlyphs: true,
          macOptionIsMeta: isMac,

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
        terminal.open(containerRef.current)

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

        terminal.parser.registerOscHandler(133, (data) => {
          const marker = data.split(';')[0]
          if (marker === 'A' || marker === 'C') {
            editableInputStartRef.current = null
            hasUserInputForPromptRef.current = false
          } else if (marker === 'B') {
            editableInputStartRef.current = getBufferCursorPosition(terminal)
            hasUserInputForPromptRef.current = false
          }

          keyboardSelectionAnchorRef.current = null
          keyboardSelectionFocusRef.current = null
          keyboardSelectionMinRef.current = null
          keyboardSelectionMaxRef.current = null
          return true
        })

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
        terminal.attachCustomKeyEventHandler((event) => {
          if (event.type !== 'keydown') return true
          if (isDisposedRef.current) return true
          if (aiStateRef.current !== 'idle') return true

          const isWordSelectHotkey = isMac
            ? event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey &&
              (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
            : event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey &&
              (event.key === 'ArrowLeft' || event.key === 'ArrowRight')

          if (isWordSelectHotkey) {
            const cursor = getBufferCursorPosition(terminal)
            const anchor = keyboardSelectionAnchorRef.current
            if (!anchor) {
              keyboardSelectionAnchorRef.current = cursor
              keyboardSelectionFocusRef.current = cursor
              const inputStart = editableInputStartRef.current
                ? cloneBufferPosition(editableInputStartRef.current)
                : inferEditableStartFromWrappedBlock(terminal, cursor)
              keyboardSelectionMinRef.current = compareBufferPositions(inputStart, cursor) <= 0
                ? inputStart
                : cloneBufferPosition(cursor)
              const inferredMax = inferEditableEndFromWrappedBlock(terminal, cursor)
              keyboardSelectionMaxRef.current = compareBufferPositions(inferredMax, cursor) >= 0
                ? inferredMax
                : cloneBufferPosition(cursor)
            }

            const focus = keyboardSelectionFocusRef.current ?? cursor
            const minBoundary = keyboardSelectionMinRef.current ?? cursor
            const maxBoundary = keyboardSelectionMaxRef.current ?? cursor
            const nextFocus = moveFocusByWord(
              terminal,
              focus,
              event.key === 'ArrowLeft' ? 'left' : 'right',
              minBoundary,
              maxBoundary
            )
            keyboardSelectionFocusRef.current = nextFocus
            applyKeyboardSelection(
              terminal,
              keyboardSelectionAnchorRef.current ?? cursor,
              nextFocus
            )
            return false
          }

          // Reset keyboard selection anchor on non-selection key presses.
          keyboardSelectionAnchorRef.current = null
          keyboardSelectionFocusRef.current = null
          keyboardSelectionMinRef.current = null
          keyboardSelectionMaxRef.current = null

          const translation = translateTerminalKey(event, isMac ? 'mac' : 'non-mac')
          if (!translation) return true

          if (!hasUserInputForPromptRef.current) {
            editableInputStartRef.current = getBufferCursorPosition(terminal)
            hasUserInputForPromptRef.current = true
          }

          window.electronAPI.writePty(tabIdRef.current, translation.data)
          return false
        })

        terminal.onData((data) => {
          if (isDisposedRef.current) return

          if (!hasUserInputForPromptRef.current) {
            editableInputStartRef.current = getBufferCursorPosition(terminal)
            hasUserInputForPromptRef.current = true
          }

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
      })()
        .finally(() => {
          isInitializingRef.current = false
        })
    },
    [handleAIInput, aiStateRef]
  )

  // Handle PTY data
  useEffect(() => {
    const unsubscribe = window.electronAPI.onPtyDataForTab(tabId, (event) => {
      if (terminalRef.current && !isDisposedRef.current) {
        terminalRef.current.write(event.data)
      }
    })
    return unsubscribe
  }, [tabId])

  // Handle PTY exit
  useEffect(() => {
    const unsubscribe = window.electronAPI.onPtyExitForTab(tabId, (event) => {
      if (terminalRef.current && !isDisposedRef.current) {
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

  // Apply runtime font-size changes to shell text only.
  useEffect(() => {
    if (!terminalRef.current || !fitAddonRef.current || isDisposedRef.current) return
    if (terminalRef.current.options.fontSize === fontSize) return

    terminalRef.current.options.fontSize = fontSize
    fitAddonRef.current.fit()
    const { cols, rows } = terminalRef.current
    if (cols > 0 && rows > 0) {
      window.electronAPI.resizePty(tabIdRef.current, cols, rows)
    }
  }, [fontSize])

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
