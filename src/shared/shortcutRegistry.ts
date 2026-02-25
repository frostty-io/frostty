export type ShortcutActionId =
  | 'newWindow'
  | 'newTab'
  | 'closeTab'
  | 'closeWindow'
  | 'restoreClosedTab'
  | 'splitOrUngroup'
  | 'commandPalette'
  | 'projectPalette'
  | 'settings'
  | 'aiMode'
  | 'clearTerminal'
  | 'openVSCode'
  | 'openCursor'
  | 'prevTabOrPane'
  | 'nextTabOrPane'

export interface ShortcutDefinition {
  key: string
  code?: string
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  display: string[]
  accelerator?: string
}

export interface ShortcutKeyEventLike {
  key: string
  code?: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}

type ShortcutMap = Record<ShortcutActionId, { mac: ShortcutDefinition; nonMac: ShortcutDefinition }>

const SHORTCUTS: ShortcutMap = {
  newWindow: {
    mac: { key: 'n', metaKey: true, shiftKey: true, display: ['⌘', 'Shift', 'N'], accelerator: 'Cmd+Shift+N' },
    nonMac: { key: 'n', ctrlKey: true, shiftKey: true, display: ['Ctrl', 'Shift', 'N'], accelerator: 'Ctrl+Shift+N' }
  },
  newTab: {
    mac: { key: 't', metaKey: true, display: ['⌘', 'T'], accelerator: 'Cmd+T' },
    nonMac: { key: 't', ctrlKey: true, shiftKey: true, display: ['Ctrl', 'Shift', 'T'], accelerator: 'Ctrl+Shift+T' }
  },
  closeTab: {
    mac: { key: 'w', metaKey: true, display: ['⌘', 'W'], accelerator: 'Cmd+W' },
    nonMac: { key: 'w', ctrlKey: true, shiftKey: true, display: ['Ctrl', 'Shift', 'W'], accelerator: 'Ctrl+Shift+W' }
  },
  closeWindow: {
    mac: { key: 'w', metaKey: true, shiftKey: true, display: ['⌘', 'Shift', 'W'], accelerator: 'Cmd+Shift+W' },
    nonMac: { key: 'q', ctrlKey: true, shiftKey: true, display: ['Ctrl', 'Shift', 'Q'], accelerator: 'Ctrl+Shift+Q' }
  },
  restoreClosedTab: {
    mac: { key: 't', metaKey: true, shiftKey: true, display: ['⌘', 'Shift', 'T'], accelerator: 'Cmd+Shift+T' },
    nonMac: { key: 't', ctrlKey: true, altKey: true, display: ['Ctrl', 'Alt', 'T'], accelerator: 'Ctrl+Alt+T' }
  },
  splitOrUngroup: {
    mac: { key: 'd', metaKey: true, display: ['⌘', 'D'] },
    nonMac: { key: 'd', ctrlKey: true, shiftKey: true, display: ['Ctrl', 'Shift', 'D'] }
  },
  commandPalette: {
    mac: { key: 'p', metaKey: true, shiftKey: true, display: ['⌘', 'Shift', 'P'] },
    nonMac: { key: 'p', ctrlKey: true, shiftKey: true, display: ['Ctrl', 'Shift', 'P'] }
  },
  projectPalette: {
    mac: { key: 'p', metaKey: true, display: ['⌘', 'P'] },
    nonMac: { key: 'o', ctrlKey: true, shiftKey: true, display: ['Ctrl', 'Shift', 'O'] }
  },
  settings: {
    mac: { key: ',', metaKey: true, display: ['⌘', ','], accelerator: 'Cmd+,' },
    nonMac: { key: ',', ctrlKey: true, display: ['Ctrl', ','], accelerator: 'Ctrl+,' }
  },
  aiMode: {
    mac: { key: 'k', metaKey: true, display: ['⌘', 'K'] },
    nonMac: { key: 'k', ctrlKey: true, shiftKey: true, display: ['Ctrl', 'Shift', 'K'] }
  },
  clearTerminal: {
    mac: { key: 'l', metaKey: true, display: ['⌘', 'L'] },
    nonMac: { key: 'l', ctrlKey: true, shiftKey: true, display: ['Ctrl', 'Shift', 'L'] }
  },
  openVSCode: {
    mac: { key: 'v', metaKey: true, shiftKey: true, display: ['⌘', 'Shift', 'V'] },
    nonMac: { key: 'v', ctrlKey: true, altKey: true, display: ['Ctrl', 'Alt', 'V'] }
  },
  openCursor: {
    mac: { key: 'c', metaKey: true, shiftKey: true, display: ['⌘', 'Shift', 'C'] },
    nonMac: { key: 'c', ctrlKey: true, altKey: true, display: ['Ctrl', 'Alt', 'C'] }
  },
  prevTabOrPane: {
    mac: { key: 'arrowup', metaKey: true, display: ['⌘', '↑'] },
    nonMac: { key: 'pageup', ctrlKey: true, display: ['Ctrl', 'PgUp'] }
  },
  nextTabOrPane: {
    mac: { key: 'arrowdown', metaKey: true, display: ['⌘', '↓'] },
    nonMac: { key: 'pagedown', ctrlKey: true, display: ['Ctrl', 'PgDn'] }
  }
}

export const GLOBAL_SHORTCUT_ACTIONS: ShortcutActionId[] = [
  'newWindow',
  'newTab',
  'closeTab',
  'closeWindow',
  'restoreClosedTab',
  'splitOrUngroup',
  'commandPalette',
  'projectPalette',
  'settings',
  'aiMode',
  'clearTerminal',
  'openVSCode',
  'openCursor',
  'prevTabOrPane',
  'nextTabOrPane'
]

export function isMacPlatform(platform: string): boolean {
  return platform.toUpperCase().includes('MAC')
}

export function getShortcutForPlatform(actionId: ShortcutActionId, isMac: boolean): ShortcutDefinition {
  return isMac ? SHORTCUTS[actionId].mac : SHORTCUTS[actionId].nonMac
}

export function getShortcutDisplay(actionId: ShortcutActionId, isMac: boolean): string[] {
  return getShortcutForPlatform(actionId, isMac).display
}

export function matchesShortcut(event: ShortcutKeyEventLike, shortcut: ShortcutDefinition): boolean {
  const key = event.key.toLowerCase()
  if (key !== shortcut.key.toLowerCase()) return false
  if (shortcut.code !== undefined && event.code !== shortcut.code) return false

  return (
    event.ctrlKey === !!shortcut.ctrlKey &&
    event.metaKey === !!shortcut.metaKey &&
    event.altKey === !!shortcut.altKey &&
    event.shiftKey === !!shortcut.shiftKey
  )
}

export function findMatchingShortcutAction(
  event: ShortcutKeyEventLike,
  isMac: boolean,
  actionIds: ShortcutActionId[] = GLOBAL_SHORTCUT_ACTIONS
): ShortcutActionId | null {
  for (const actionId of actionIds) {
    if (matchesShortcut(event, getShortcutForPlatform(actionId, isMac))) {
      return actionId
    }
  }
  return null
}
