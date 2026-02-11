import { useCallback } from 'react'
import { toast } from 'sonner'
import type { GitOperationResult } from '../../../shared/ipc'

export function useGitOperations(cwd: string | null) {
  const runGitOperation = useCallback(
    async (operation: () => Promise<GitOperationResult>, successMessage?: string) => {
      if (!cwd) {
        toast.error('No active directory to run Git command')
        return
      }
      try {
        const result = await operation()
        if (result.success) {
          toast.success(successMessage || result.message)
        } else {
          toast.error(result.error || result.message)
        }
      } catch (err) {
        toast.error((err as Error).message)
      }
    },
    [cwd]
  )

  const fetch = useCallback(() => {
    return runGitOperation(() => window.electronAPI.gitFetch(cwd || ''), 'Fetched all remotes')
  }, [cwd, runGitOperation])

  const pull = useCallback(() => {
    return runGitOperation(() => window.electronAPI.gitPull(cwd || ''))
  }, [cwd, runGitOperation])

  const push = useCallback(
    (force = false) => {
      return runGitOperation(() => window.electronAPI.gitPush(cwd || '', force))
    },
    [cwd, runGitOperation]
  )

  const checkout = useCallback(
    (branch: string, create = false) => {
      return runGitOperation(
        () => window.electronAPI.gitCheckout(cwd || '', branch, create),
        `Switched to ${branch}`
      )
    },
    [cwd, runGitOperation]
  )

  return { runGitOperation, fetch, pull, push, checkout }
}
