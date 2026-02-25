import { describe, expect, it } from 'vitest'
import { translateTerminalKey } from '../../lib/terminalKeyTranslation'

function buildEvent({
  key,
  altKey = false,
  ctrlKey = false,
  metaKey = false,
  shiftKey = false
}: {
  key: string
  altKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
}) {
  return { key, altKey, ctrlKey, metaKey, shiftKey }
}

describe('translateTerminalKey', () => {
  it('maps macOS option/cmd terminal editing keys', () => {
    expect(translateTerminalKey(buildEvent({ key: 'ArrowLeft', altKey: true }), 'mac')).toEqual({ data: '\x1bb' })
    expect(translateTerminalKey(buildEvent({ key: 'ArrowRight', altKey: true }), 'mac')).toEqual({ data: '\x1bf' })
    expect(translateTerminalKey(buildEvent({ key: 'Backspace', altKey: true }), 'mac')).toEqual({ data: '\x17' })
    expect(translateTerminalKey(buildEvent({ key: 'Delete', altKey: true }), 'mac')).toEqual({ data: '\x1bd' })
    expect(translateTerminalKey(buildEvent({ key: 'ArrowLeft', metaKey: true }), 'mac')).toEqual({ data: '\x01' })
    expect(translateTerminalKey(buildEvent({ key: 'ArrowRight', metaKey: true }), 'mac')).toEqual({ data: '\x05' })
    expect(translateTerminalKey(buildEvent({ key: 'Backspace', metaKey: true }), 'mac')).toEqual({ data: '\x15' })
    expect(translateTerminalKey(buildEvent({ key: 'Delete', metaKey: true }), 'mac')).toEqual({ data: '\x0b' })
  })

  it('does not translate selection hotkeys handled by xterm selection api', () => {
    expect(translateTerminalKey(buildEvent({ key: 'ArrowLeft', altKey: true, shiftKey: true }), 'mac')).toBeNull()
    expect(translateTerminalKey(buildEvent({ key: 'ArrowRight', altKey: true, shiftKey: true }), 'mac')).toBeNull()
    expect(translateTerminalKey(buildEvent({ key: 'ArrowLeft', ctrlKey: true, shiftKey: true }), 'non-mac')).toBeNull()
    expect(translateTerminalKey(buildEvent({ key: 'ArrowRight', ctrlKey: true, shiftKey: true }), 'non-mac')).toBeNull()
  })

  it('maps windows/linux ctrl terminal editing keys', () => {
    expect(translateTerminalKey(buildEvent({ key: 'ArrowLeft', ctrlKey: true }), 'non-mac')).toEqual({ data: '\x1bb' })
    expect(translateTerminalKey(buildEvent({ key: 'ArrowRight', ctrlKey: true }), 'non-mac')).toEqual({ data: '\x1bf' })
    expect(translateTerminalKey(buildEvent({ key: 'Backspace', ctrlKey: true }), 'non-mac')).toEqual({ data: '\x17' })
    expect(translateTerminalKey(buildEvent({ key: 'Delete', ctrlKey: true }), 'non-mac')).toEqual({ data: '\x1bd' })
  })

  it('returns null for unmapped keys', () => {
    expect(translateTerminalKey(buildEvent({ key: 'a' }), 'mac')).toBeNull()
    expect(translateTerminalKey(buildEvent({ key: 'ArrowLeft', ctrlKey: true }), 'mac')).toBeNull()
    expect(translateTerminalKey(buildEvent({ key: 'ArrowLeft', altKey: true }), 'non-mac')).toBeNull()
  })
})
