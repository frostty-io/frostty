import { useState, useEffect, useCallback, useRef } from 'react'
import {
  GitMerge,
  ArrowUp,
  ArrowDown,
  Plus,
  Minus,
  FileEdit,
  AlertCircle,
  Archive,
  Loader2,
  CloudOff
} from 'lucide-react'
import { useGitOperations } from '@/hooks/useGitOperations'
import { useEditorIntegration } from '@/hooks/useEditorIntegration'
import type { GitStatus, GitBranch as GitBranchType } from '@shared/ipc'
import BranchSelector from './BranchSelector'
import GitActions, { type OperationState } from './GitActions'

interface GitBarProps {
  cwd: string
}

export default function GitBar({ cwd }: GitBarProps) {
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [branches, setBranches] = useState<GitBranchType[]>([])
  const [operationState, setOperationState] = useState<OperationState>('idle')

  const gitOps = useGitOperations(cwd)
  const { openInVSCode, openInCursor } = useEditorIntegration(cwd)

  // Fetch git status
  const fetchStatus = useCallback(async () => {
    if (!cwd) return
    try {
      const gitStatus = await window.electronAPI.gitStatus(cwd)
      setStatus(gitStatus)
    } catch (err) {
      console.error('Failed to get git status:', err)
    }
  }, [cwd])

  // Fetch branches
  const fetchBranches = useCallback(async () => {
    if (!cwd) return
    try {
      const gitBranches = await window.electronAPI.gitBranches(cwd)
      setBranches(gitBranches)
    } catch (err) {
      console.error('Failed to get branches:', err)
    }
  }, [cwd])

  // Initial fetch and polling (5s when visible and in a repo; skip when hidden or not a repo)
  const fetchInProgressRef = useRef(false)
  const GIT_POLL_INTERVAL_MS = 5000
  useEffect(() => {
    fetchStatus()
    fetchBranches()
    const interval = setInterval(() => {
      if (document.hidden) return
      if (fetchInProgressRef.current) return
      if (status?.isRepo === false) return
      fetchInProgressRef.current = true
      fetchStatus().finally(() => {
        fetchInProgressRef.current = false
      })
    }, GIT_POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchStatus, fetchBranches, status?.isRepo])

  // Wrap operations with loading state tracking
  const withLoading = useCallback(async (op: () => Promise<void>) => {
    setOperationState('loading')
    try {
      await op()
      setOperationState('success')
      fetchStatus()
      fetchBranches()
    } catch {
      setOperationState('error')
    }
    setTimeout(() => setOperationState('idle'), 1500)
  }, [fetchStatus, fetchBranches])

  const handleCheckout = useCallback(
    (branch: string) => withLoading(() => gitOps.checkout(branch)),
    [withLoading, gitOps]
  )

  const handleCreateBranch = useCallback(
    (name: string) => withLoading(() => gitOps.checkout(name, true)),
    [withLoading, gitOps]
  )

  const handleFetch = useCallback(
    () => withLoading(() => gitOps.fetch()),
    [withLoading, gitOps]
  )

  const handlePull = useCallback(
    () => withLoading(() => gitOps.pull()),
    [withLoading, gitOps]
  )

  // Don't render if not a git repo
  if (!status?.isRepo) {
    return (
      <div className="h-11 flex items-center px-4 border-b border-white/5 bg-[hsl(var(--sidebar-bg))] text-muted-foreground">
        <CloudOff className="w-4 h-4 mr-2 opacity-50" />
        <span className="text-xs font-mono opacity-60">Not a git repository</span>
      </div>
    )
  }

  const hasConflicts = status.conflicted.length > 0

  return (
    <div className="h-11 flex items-center px-3 gap-1 border-b border-white/5 bg-[hsl(var(--sidebar-bg))] no-select relative">
      {/* Loading overlay */}
      {operationState === 'loading' && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-50">
          <Loader2 className="w-4 h-4 animate-spin text-accent" />
        </div>
      )}

      {/* Branch selector */}
      <BranchSelector
        status={status}
        branches={branches}
        onCheckout={handleCheckout}
        onCreateBranch={handleCreateBranch}
        onRefreshBranches={fetchBranches}
      />

      {/* Sync status (ahead/behind) */}
      {status.upstream && (
        <div className="flex items-center gap-1 text-xs font-mono">
          {status.ahead > 0 && (
            <span className="flex items-center gap-0.5 px-2 py-1 text-amber-400" title={`${status.ahead} commits ahead`}>
              <ArrowUp className="w-3 h-3" />
              {status.ahead}
            </span>
          )}
          {status.behind > 0 && (
            <button
              onClick={handlePull}
              className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-white/5 text-cyan-400 transition-colors"
              title={`${status.behind} commits behind - click to pull`}
            >
              <ArrowDown className="w-3.5 h-3.5" />
              <span>{status.behind}</span>
            </button>
          )}
          {status.ahead === 0 && status.behind === 0 && (
            <span className="text-muted-foreground/50 px-2 py-1" title="In sync">
              <GitMerge className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
      )}

      {/* Separator */}
      <div className="w-px h-5 bg-white/10 mx-1" />

      {/* File changes indicators */}
      <div className="flex items-center gap-2 px-2">
        {status.staged.length > 0 && (
          <span className="flex items-center gap-1 text-xs font-mono text-emerald-400" title="Staged files">
            <Plus className="w-3 h-3" />
            {status.staged.length}
          </span>
        )}
        {status.unstaged.length > 0 && (
          <span className="flex items-center gap-1 text-xs font-mono text-amber-400" title="Modified files">
            <FileEdit className="w-3 h-3" />
            {status.unstaged.length}
          </span>
        )}
        {status.untracked.length > 0 && (
          <span className="flex items-center gap-1 text-xs font-mono text-muted-foreground" title="Untracked files">
            <Minus className="w-3 h-3" />
            {status.untracked.length}
          </span>
        )}
        {hasConflicts && (
          <span className="flex items-center gap-1 text-xs font-mono text-red-400" title="Conflicts">
            <AlertCircle className="w-3 h-3" />
            {status.conflicted.length}
          </span>
        )}
        {status.staged.length === 0 && status.unstaged.length === 0 && status.untracked.length === 0 && !hasConflicts && (
          <span className="text-xs text-muted-foreground/50 font-mono">Clean</span>
        )}
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-white/10 mx-1" />

      {/* Stash indicator */}
      {status.stashCount > 0 && (
        <>
          <div
            className="flex items-center gap-1 px-2 py-1 text-violet-400"
            title={`${status.stashCount} stash ${status.stashCount === 1 ? 'entry' : 'entries'}`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span className="text-xs font-mono">{status.stashCount}</span>
          </div>
          <div className="w-px h-5 bg-white/10 mx-1" />
        </>
      )}

      {/* Actions */}
      <GitActions
        cwd={cwd}
        status={status}
        operationState={operationState}
        onFetch={handleFetch}
        onPull={handlePull}
        onOpenInVSCode={openInVSCode}
        onOpenInCursor={openInCursor}
      />
    </div>
  )
}
