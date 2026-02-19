interface PtyCwdEntry {
  cwd: string
  updatedAt: number
}

const cwdByTabId = new Map<string, PtyCwdEntry>()

export function updatePtyCwd(tabId: string, cwd: string, now = Date.now()): void {
  cwdByTabId.set(tabId, { cwd, updatedAt: now })
}

export function getCachedPtyCwd(tabId: string): string | null {
  return cwdByTabId.get(tabId)?.cwd ?? null
}

export function getPtyCwdUpdatedAt(tabId: string): number | null {
  return cwdByTabId.get(tabId)?.updatedAt ?? null
}

export function isPtyCwdFresh(tabId: string, maxAgeMs: number, now = Date.now()): boolean {
  const updatedAt = getPtyCwdUpdatedAt(tabId)
  if (updatedAt === null) return false
  return now - updatedAt <= maxAgeMs
}

export function clearPtyCwd(tabId: string): void {
  cwdByTabId.delete(tabId)
}

export function clearAllPtyCwd(): void {
  cwdByTabId.clear()
}

export function __getPtyCwdCacheSizeForTests(): number {
  return cwdByTabId.size
}
