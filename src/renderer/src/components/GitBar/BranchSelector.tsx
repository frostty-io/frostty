import { useState, useRef, useEffect } from 'react'
import {
  GitBranch,
  ChevronDown,
  Check,
  X,
  Plus
} from 'lucide-react'
import type { GitStatus, GitBranch as GitBranchType } from '@shared/ipc'

interface BranchSelectorProps {
  status: GitStatus
  branches: GitBranchType[]
  onCheckout: (branch: string) => void
  onCreateBranch: (name: string) => void
  onRefreshBranches: () => void
}

export default function BranchSelector({
  status,
  branches,
  onCheckout,
  onCreateBranch,
  onRefreshBranches
}: BranchSelectorProps) {
  const [showBranchDropdown, setShowBranchDropdown] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [showNewBranchInput, setShowNewBranchInput] = useState(false)

  const branchDropdownRef = useRef<HTMLDivElement>(null)
  const newBranchInputRef = useRef<HTMLInputElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (branchDropdownRef.current && !branchDropdownRef.current.contains(e.target as Node)) {
        setShowBranchDropdown(false)
        setShowNewBranchInput(false)
        setNewBranchName('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus new branch input when shown
  useEffect(() => {
    if (showNewBranchInput && newBranchInputRef.current) {
      newBranchInputRef.current.focus()
    }
  }, [showNewBranchInput])

  const handleCheckout = (branch: string) => {
    setShowBranchDropdown(false)
    onCheckout(branch)
  }

  const handleCreateBranch = () => {
    if (!newBranchName.trim()) return
    setShowNewBranchInput(false)
    setShowBranchDropdown(false)
    onCreateBranch(newBranchName.trim())
    setNewBranchName('')
  }

  const localBranches = branches.filter(b => !b.remote)
  const remoteBranches = branches.filter(b => b.remote && !localBranches.some(lb => b.name.endsWith(`/${lb.name}`)))

  return (
    <div className="relative" ref={branchDropdownRef}>
      <button
        onClick={() => {
          setShowBranchDropdown(!showBranchDropdown)
          if (!showBranchDropdown) onRefreshBranches()
        }}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-white/5 transition-colors group"
      >
        <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-xs font-mono font-medium text-foreground max-w-[120px] truncate">
          {status.branch}
        </span>
        <ChevronDown className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
      </button>

      {/* Branch dropdown */}
      {showBranchDropdown && (
        <div className="absolute top-full left-0 mt-1 w-64 max-h-80 overflow-y-auto bg-[hsl(var(--card))] border border-white/10 rounded-lg shadow-xl z-50">
          {/* New branch input */}
          {showNewBranchInput ? (
            <div className="p-2 border-b border-white/5">
              <div className="flex gap-1">
                <input
                  ref={newBranchInputRef}
                  type="text"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateBranch()
                    if (e.key === 'Escape') {
                      setShowNewBranchInput(false)
                      setNewBranchName('')
                    }
                  }}
                  placeholder="New branch name..."
                  className="flex-1 px-2 py-1 text-xs bg-black/20 border border-white/10 rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent/50"
                />
                <button
                  onClick={handleCreateBranch}
                  disabled={!newBranchName.trim()}
                  className="p-1 rounded hover:bg-white/10 text-emerald-400 disabled:opacity-30"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setShowNewBranchInput(false)
                    setNewBranchName('')
                  }}
                  className="p-1 rounded hover:bg-white/10 text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNewBranchInput(true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 text-accent border-b border-white/5"
            >
              <Plus className="w-3.5 h-3.5" />
              Create new branch
            </button>
          )}

          {/* Local branches */}
          <div className="py-1">
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Local
            </div>
            {localBranches.map((branch) => (
              <button
                key={branch.name}
                onClick={() => handleCheckout(branch.name)}
                disabled={branch.current}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/5 ${
                  branch.current ? 'text-accent' : 'text-foreground'
                }`}
              >
                {branch.current && <Check className="w-3 h-3" />}
                <span className={branch.current ? '' : 'ml-5'}>{branch.name}</span>
              </button>
            ))}
          </div>

          {/* Remote branches */}
          {remoteBranches.length > 0 && (
            <div className="py-1 border-t border-white/5">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                Remote
              </div>
              {remoteBranches.slice(0, 10).map((branch) => (
                <button
                  key={branch.name}
                  onClick={() => handleCheckout(branch.name.replace(/^origin\//, ''))}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/5 text-muted-foreground"
                >
                  <span className="ml-5">{branch.name}</span>
                </button>
              ))}
              {remoteBranches.length > 10 && (
                <div className="px-3 py-1.5 text-[10px] text-muted-foreground/50">
                  +{remoteBranches.length - 10} more
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
