export type TerminalKeyPlatform = 'mac' | 'non-mac'

export interface TerminalKeyTranslationResult {
  data: string
}

export interface TerminalKeyEventLike {
  key: string
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}

interface TerminalKeyBinding {
  key: string
  altKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  data: string
}

const MAC_BINDINGS: TerminalKeyBinding[] = [
  { key: 'arrowleft', altKey: true, data: '\x1bb' },
  { key: 'arrowright', altKey: true, data: '\x1bf' },
  { key: 'backspace', altKey: true, data: '\x17' },
  { key: 'delete', altKey: true, data: '\x1bd' },
  { key: 'arrowleft', metaKey: true, data: '\x01' },
  { key: 'arrowright', metaKey: true, data: '\x05' },
  { key: 'backspace', metaKey: true, data: '\x15' },
  { key: 'delete', metaKey: true, data: '\x0b' }
]

const NON_MAC_BINDINGS: TerminalKeyBinding[] = [
  { key: 'arrowleft', ctrlKey: true, data: '\x1bb' },
  { key: 'arrowright', ctrlKey: true, data: '\x1bf' },
  { key: 'backspace', ctrlKey: true, data: '\x17' },
  { key: 'delete', ctrlKey: true, data: '\x1bd' }
]

function matchesBinding(event: TerminalKeyEventLike, binding: TerminalKeyBinding): boolean {
  const key = event.key.toLowerCase()
  if (key !== binding.key) return false

  return (
    event.altKey === !!binding.altKey &&
    event.ctrlKey === !!binding.ctrlKey &&
    event.metaKey === !!binding.metaKey &&
    event.shiftKey === !!binding.shiftKey
  )
}

export function translateTerminalKey(
  event: TerminalKeyEventLike,
  platform: TerminalKeyPlatform
): TerminalKeyTranslationResult | null {
  const bindings = platform === 'mac' ? MAC_BINDINGS : NON_MAC_BINDINGS
  for (const binding of bindings) {
    if (matchesBinding(event, binding)) {
      return { data: binding.data }
    }
  }
  return null
}
