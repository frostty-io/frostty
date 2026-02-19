import { useState, useEffect, useRef } from 'react'
import type { GitRepoInfoResult } from '@shared/ipc'
import { GIT_REPO_INFO_CACHE_MS } from '../../../shared/constants'

const GIT_REPO_INFO_POLL_MS = 10_000 // poll every 10s (branch can change)

interface RepoInfoCacheEntry {
  value: GitRepoInfoResult | null
  updatedAt: number
  inFlight: Promise<GitRepoInfoResult | null> | null
}

const repoInfoCache = new Map<string, RepoInfoCacheEntry>()

function getCacheEntry(cwd: string): RepoInfoCacheEntry {
  let entry = repoInfoCache.get(cwd)
  if (!entry) {
    entry = { value: null, updatedAt: 0, inFlight: null }
    repoInfoCache.set(cwd, entry)
  }
  return entry
}

async function fetchRepoInfoCached(cwd: string, force = false): Promise<GitRepoInfoResult | null> {
  const entry = getCacheEntry(cwd)
  const now = Date.now()

  if (!force && entry.value && now - entry.updatedAt < GIT_REPO_INFO_CACHE_MS) {
    return entry.value
  }
  if (entry.inFlight) return entry.inFlight

  entry.inFlight = window.electronAPI.gitRepoInfo(cwd)
    .then((result) => {
      entry.value = result
      entry.updatedAt = Date.now()
      return result
    })
    .catch(() => {
      entry.value = null
      entry.updatedAt = Date.now()
      return null
    })
    .finally(() => {
      entry.inFlight = null
    })

  return entry.inFlight
}

/**
 * Lightweight hook that returns git repo name + branch for a given CWD.
 * The cache is keyed by CWD to dedupe parallel tab/pane requests.
 */
export function useGitRepoInfo(cwd: string | undefined): GitRepoInfoResult | null {
  const [info, setInfo] = useState<GitRepoInfoResult | null>(null)
  const activeCwdRef = useRef(cwd)

  useEffect(() => {
    activeCwdRef.current = cwd

    if (!cwd) {
      setInfo(null)
      return
    }

    void fetchRepoInfoCached(cwd, false).then((result) => {
      if (activeCwdRef.current === cwd) {
        setInfo(result)
      }
    })

    const interval = setInterval(() => {
      if (document.hidden) return
      void fetchRepoInfoCached(cwd, false).then((result) => {
        if (activeCwdRef.current === cwd) {
          setInfo(result)
        }
      })
    }, GIT_REPO_INFO_POLL_MS)

    return () => clearInterval(interval)
  }, [cwd])

  return info
}

export function __clearGitRepoInfoCacheForTests(): void {
  repoInfoCache.clear()
}
