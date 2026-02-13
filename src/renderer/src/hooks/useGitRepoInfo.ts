import { useState, useEffect, useRef, useCallback } from 'react'
import type { GitRepoInfoResult } from '@shared/ipc'

const GIT_REPO_INFO_POLL_MS = 10_000 // poll every 10s (branch can change)

/**
 * Lightweight hook that returns git repo name + branch for a given CWD.
 * Uses the fast `git:repoInfo` IPC channel (only 2 git commands) so it's
 * safe to call for every tab simultaneously.
 *
 * To avoid flicker, the previous result is kept visible while a new fetch
 * is in-flight. The display only updates once the new result arrives.
 */
export function useGitRepoInfo(cwd: string | undefined): GitRepoInfoResult | null {
  const [info, setInfo] = useState<GitRepoInfoResult | null>(null)
  const activeCwdRef = useRef(cwd)

  const fetchInfo = useCallback(async (targetCwd: string) => {
    try {
      const result = await window.electronAPI.gitRepoInfo(targetCwd)
      // Only apply if this CWD is still the current one (avoids race conditions)
      if (activeCwdRef.current === targetCwd) {
        setInfo(result)
      }
    } catch {
      if (activeCwdRef.current === targetCwd) {
        setInfo(null)
      }
    }
  }, [])

  useEffect(() => {
    activeCwdRef.current = cwd

    if (!cwd) {
      setInfo(null)
      return
    }

    // Fetch immediately — old info stays visible until this resolves
    fetchInfo(cwd)

    // Poll for branch changes (e.g. user switches branches in terminal)
    const interval = setInterval(() => {
      if (document.hidden) return
      fetchInfo(cwd)
    }, GIT_REPO_INFO_POLL_MS)

    return () => clearInterval(interval)
  }, [cwd, fetchInfo])

  return info
}
