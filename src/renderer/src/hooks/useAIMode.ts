import { useRef, useCallback, useEffect } from 'react'
import type { Terminal } from '@xterm/xterm'
import type { ShellType } from '../../../shared/ipc'
import {
  AI_SPINNER_FRAMES,
  AI_SPINNER_INTERVAL,
  AI_ERROR_DISPLAY_DURATION
} from '../../../shared/constants'
import { isMacPlatform } from '@/lib/shortcutRegistry'

// AI mode state types
type AIState = 'idle' | 'input' | 'loading'

interface UseAIModeOptions {
  terminalRef: React.MutableRefObject<Terminal | null>
  tabIdRef: React.MutableRefObject<string>
  shellRef: React.MutableRefObject<ShellType | undefined>
  openRouterApiKey?: string
  openRouterModel?: string
  currentCwd?: string
}

export function useAIMode({
  terminalRef,
  tabIdRef,
  shellRef,
  openRouterApiKey,
  openRouterModel,
  currentCwd
}: UseAIModeOptions) {
  const settingsShortcut = typeof navigator !== 'undefined' && isMacPlatform(navigator.platform)
    ? 'Cmd+,'
    : 'Ctrl+,'

  // AI mode refs
  const aiStateRef = useRef<AIState>('idle')
  const aiInputBufferRef = useRef('')
  const aiSpinnerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const aiSpinnerFrameRef = useRef(0)
  const aiCharsWrittenRef = useRef(0)
  const openRouterApiKeyRef = useRef(openRouterApiKey)
  const openRouterModelRef = useRef(openRouterModel)
  const currentCwdRef = useRef(currentCwd)

  // Keep refs updated
  openRouterApiKeyRef.current = openRouterApiKey
  openRouterModelRef.current = openRouterModel
  currentCwdRef.current = currentCwd

  // Helper to erase N characters (backspace, space, backspace for each)
  const eraseChars = useCallback((count: number) => {
    if (count <= 0) return ''
    return '\b \b'.repeat(count)
  }, [])

  // Stop the loading spinner
  const stopSpinner = useCallback(() => {
    if (aiSpinnerIntervalRef.current) {
      clearInterval(aiSpinnerIntervalRef.current)
      aiSpinnerIntervalRef.current = null
    }
  }, [])

  // Start the loading spinner animation
  const startSpinner = useCallback(() => {
    const terminal = terminalRef.current
    if (!terminal) return

    aiSpinnerFrameRef.current = 0

    // Write initial spinner
    terminal.write(AI_SPINNER_FRAMES[0])

    aiSpinnerIntervalRef.current = setInterval(() => {
      aiSpinnerFrameRef.current = (aiSpinnerFrameRef.current + 1) % AI_SPINNER_FRAMES.length
      terminal.write('\b' + AI_SPINNER_FRAMES[aiSpinnerFrameRef.current])
    }, AI_SPINNER_INTERVAL)
  }, [terminalRef])

  // Exit AI mode and clean up
  const exitAIMode = useCallback(() => {
    stopSpinner()

    const charsToErase = aiCharsWrittenRef.current
    if (charsToErase > 0) {
      terminalRef.current?.write(eraseChars(charsToErase))
    }

    aiStateRef.current = 'idle'
    aiInputBufferRef.current = ''
    aiCharsWrittenRef.current = 0
  }, [stopSpinner, eraseChars, terminalRef])

  // Handle AI command generation result
  const handleAIResult = useCallback(async (instruction: string) => {
    const terminal = terminalRef.current
    if (!terminal) return

    aiStateRef.current = 'loading'

    // Erase the AI prompt and user input, show loading message
    const charsToErase = aiCharsWrittenRef.current
    const loadingText = 'Generating... '
    terminal.write(eraseChars(charsToErase) + '\x1b[33m' + loadingText + '\x1b[0m')
    aiCharsWrittenRef.current = loadingText.length + 1 // +1 for spinner
    startSpinner()

    try {
      const result = await window.electronAPI.generateAICommand({
        instruction,
        shell: shellRef.current || 'zsh',
        cwd: currentCwdRef.current || '~',
        apiKey: openRouterApiKeyRef.current || '',
        model: openRouterModelRef.current || 'openai/gpt-oss-120b'
      })

      stopSpinner()

      if (result.success && result.command) {
        // Erase the loading message
        terminal.write(eraseChars(aiCharsWrittenRef.current))

        // Write the generated command to PTY
        window.electronAPI.writePty(tabIdRef.current, result.command)

        aiStateRef.current = 'idle'
        aiInputBufferRef.current = ''
        aiCharsWrittenRef.current = 0
      } else {
        // Erase loading, show error
        const errorText = 'Error: ' + (result.error || 'Unknown error')
        terminal.write(eraseChars(aiCharsWrittenRef.current) + '\x1b[31m' + errorText + '\x1b[0m')
        aiCharsWrittenRef.current = errorText.length
        setTimeout(() => {
          exitAIMode()
        }, AI_ERROR_DISPLAY_DURATION)
      }
    } catch (error) {
      stopSpinner()
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      const errorText = 'Error: ' + errorMsg
      terminal.write(eraseChars(aiCharsWrittenRef.current) + '\x1b[31m' + errorText + '\x1b[0m')
      aiCharsWrittenRef.current = errorText.length
      setTimeout(() => {
        exitAIMode()
      }, AI_ERROR_DISPLAY_DURATION)
    }
  }, [terminalRef, tabIdRef, shellRef, startSpinner, stopSpinner, exitAIMode, eraseChars])

  // Handle input while in AI mode
  const handleAIInput = useCallback(
    (data: string) => {
      const terminal = terminalRef.current
      if (!terminal) return

      // Don't accept input while loading
      if (aiStateRef.current === 'loading') return

      // Strip bracketed paste escape sequences
      let cleaned = data.replace(/\x1b\[200~/g, '').replace(/\x1b\[201~/g, '')

      // For pasted text, replace newlines with spaces
      if (cleaned.length > 1) {
        cleaned = cleaned.replace(/\r\n|\r|\n/g, ' ')
      }

      for (const char of cleaned) {
        const code = char.charCodeAt(0)

        // Escape (27) - cancel AI mode
        if (code === 27) {
          exitAIMode()
          return
        }

        // Enter (13) - submit instruction
        if (code === 13) {
          const instruction = aiInputBufferRef.current.trim()
          if (instruction) {
            handleAIResult(instruction)
          } else {
            exitAIMode()
          }
          return
        }

        // Backspace (127 or 8)
        if (code === 127 || code === 8) {
          if (aiInputBufferRef.current.length > 0) {
            aiInputBufferRef.current = aiInputBufferRef.current.slice(0, -1)
            aiCharsWrittenRef.current--
            terminal.write('\b \b')
          }
          continue
        }

        // Ctrl+C (3) - cancel
        if (code === 3) {
          exitAIMode()
          return
        }

        // Printable characters (code >= 32, excluding DEL at 127)
        if (code >= 32 && code !== 127) {
          aiInputBufferRef.current += char
          aiCharsWrittenRef.current++
          terminal.write(char)
        }
      }
    },
    [terminalRef, handleAIResult, exitAIMode]
  )

  // Enter AI input mode
  const enterAIMode = useCallback(() => {
    const terminal = terminalRef.current
    if (!terminal || aiStateRef.current !== 'idle') return

    if (!openRouterApiKeyRef.current) {
      terminal.write(
        `\r\n\x1b[31mError:\x1b[0m OpenRouter API key not configured. Set it in Settings (${settingsShortcut})\r\n`
      )
      return
    }

    aiStateRef.current = 'input'
    aiInputBufferRef.current = ''

    const aiPrompt = 'AI> '
    terminal.write('\x1b[36m' + aiPrompt + '\x1b[0m')
    aiCharsWrittenRef.current = aiPrompt.length
  }, [terminalRef, settingsShortcut])

  // Cleanup AI spinner on unmount
  useEffect(() => {
    return () => {
      stopSpinner()
    }
  }, [stopSpinner])

  return {
    enterAIMode,
    handleAIInput,
    aiStateRef
  }
}
