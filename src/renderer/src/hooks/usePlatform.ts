import { useMemo } from 'react'

interface PlatformInfo {
  isMac: boolean
  modKey: string
  modSymbol: string
}

export function usePlatform(): PlatformInfo {
  return useMemo(() => {
    const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0
    return {
      isMac,
      modKey: isMac ? 'Meta' : 'Control',
      modSymbol: isMac ? '⌘' : 'Ctrl'
    }
  }, [])
}
