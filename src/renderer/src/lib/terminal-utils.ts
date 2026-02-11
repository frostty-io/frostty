/**
 * Extract the shell name from a full shell path
 * @param shellPath - Full path to shell executable (e.g., /bin/zsh)
 * @returns Shell name (e.g., zsh)
 */
export function getShellName(shellPath: string): string {
  if (!shellPath) return 'shell'
  const parts = shellPath.split('/')
  const name = parts[parts.length - 1]
  return name || 'shell'
}

/**
 * Shorten a path by replacing home directory with ~ and limiting segments
 * @param path - Full path to shorten
 * @param maxSegments - Maximum number of path segments to show (default: 3)
 * @returns Shortened path
 */
export function shortenPath(path: string, maxSegments: number = 3): string {
  if (!path) return '~/';
  if (path == '~') return '~/';

  // Split by path separator
  const separator = path.includes('\\') ? '\\' : '/'
  const parts = path.split(separator).filter(p => p.length > 0)

  // If path is short enough, return as-is
  if (parts.length <= maxSegments) {
    return parts.join(separator)
  }

  // Show first part and last segments
  const first = parts[0]
  const last = parts.slice(-maxSegments + 1)

  return `${first}${separator}...${separator}${last.join(separator)}`
}

/**
 * Format keyboard shortcut for display
 * @param key - The key (e.g., '1', '2')
 * @param modSymbol - The modifier symbol (e.g., '⌘' or 'Ctrl') from usePlatform
 * @param modifiers - Modifier keys (e.g., ['Ctrl', 'Shift'])
 * @returns Array of key parts (e.g., ['⌘', '1'] or ['Ctrl', '1'])
 */
export function formatHotkey(key: string, modSymbol: string, modifiers: string[] = []): string[] {
  // For number keys, use Cmd/Ctrl + number
  if (modifiers.length === 0) {
    return [modSymbol, key]
  }

  return [...modifiers, key]
}
