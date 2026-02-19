import { useCallback, useRef } from 'react'
import { useTabStore } from '../stores/useTabStore'
import { SPLIT_PANE_MIN_PCT, SPLIT_PANE_MAX_PCT } from '../../../shared/constants'

/**
 * Hook for handling split pane resizing via mouse drag.
 */
export function useSplitPane() {
  const terminalAreaRef = useRef<HTMLDivElement>(null)
  const resizingTabRef = useRef<string | null>(null)

  const startResize = useCallback((e: React.MouseEvent, tabId: string) => {
    e.preventDefault()
    resizingTabRef.current = tabId
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    let rafId: number | null = null
    let pendingEv: MouseEvent | null = null

    const onMove = (ev: MouseEvent) => {
      if (!resizingTabRef.current || !terminalAreaRef.current) return
      pendingEv = ev
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        const e = pendingEv
        pendingEv = null
        if (!e || !resizingTabRef.current || !terminalAreaRef.current) return
        const rect = terminalAreaRef.current.getBoundingClientRect()
        const pct = ((e.clientX - rect.left) / rect.width) * 100
        const clamped = Math.max(SPLIT_PANE_MIN_PCT, Math.min(SPLIT_PANE_MAX_PCT, pct))
        useTabStore.getState().setSplitSize(resizingTabRef.current, clamped)
      })
    }

    const onUp = () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = null
      pendingEv = null
      resizingTabRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  return { terminalAreaRef, startResize }
}
