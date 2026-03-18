import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, GitBranch, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { GitStatus, GitBranch as GitBranchType } from '@shared/ipc'

interface BranchSelectorProps {
  status: GitStatus
  branches: GitBranchType[]
  open: boolean
  createMode?: boolean
  onOpenChange: (open: boolean) => void
  onCheckout: (branch: string) => void
  onCreateBranch: (name: string) => void
  onRefreshBranches: () => void
}

export default function BranchSelector({
  status,
  branches,
  open,
  createMode,
  onOpenChange,
  onCheckout,
  onCreateBranch,
  onRefreshBranches
}: BranchSelectorProps) {
  const [newBranchName, setNewBranchName] = useState('')
  const [branchSearch, setBranchSearch] = useState('')
  const [showNewBranchInput, setShowNewBranchInput] = useState(false)

  const newBranchInputRef = useRef<HTMLInputElement>(null)
  const branchSearchInputRef = useRef<HTMLInputElement>(null)

  const focusBranchSearch = () => {
    requestAnimationFrame(() => {
      branchSearchInputRef.current?.focus()
    })
  }

  useEffect(() => {
    if (showNewBranchInput) {
      requestAnimationFrame(() => {
        newBranchInputRef.current?.focus()
      })
    }
  }, [showNewBranchInput])

  useEffect(() => {
    if (open && !showNewBranchInput && branchSearchInputRef.current) {
      focusBranchSearch()
    }
  }, [open, showNewBranchInput])

  useEffect(() => {
    if (!open) {
      setShowNewBranchInput(false)
      setNewBranchName('')
      setBranchSearch('')
      return
    }

    setShowNewBranchInput(!!createMode)
    setBranchSearch('')
    onRefreshBranches()
  }, [open, createMode, onRefreshBranches])

  const handleCheckout = (branch: string) => {
    onOpenChange(false)
    onCheckout(branch)
  }

  const handleCreateBranch = () => {
    if (!newBranchName.trim()) return
    setShowNewBranchInput(false)
    onOpenChange(false)
    onCreateBranch(newBranchName.trim())
    setNewBranchName('')
  }

  const localBranches = branches.filter((b) => !b.remote)
  const remoteBranches = branches.filter((b) => b.remote && !localBranches.some((lb) => b.name.endsWith(`/${lb.name}`)))
  const normalizedBranchSearch = branchSearch.trim().toLowerCase()
  const filteredLocalBranches = normalizedBranchSearch
    ? localBranches.filter((branch) => branch.name.toLowerCase().includes(normalizedBranchSearch))
    : localBranches
  const filteredRemoteBranches = normalizedBranchSearch
    ? remoteBranches.filter((branch) => branch.name.toLowerCase().includes(normalizedBranchSearch))
    : remoteBranches

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-auto justify-start gap-1.5 px-2.5 py-1.5 text-left group">
          <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
          <span className="block max-w-[120px] truncate text-left text-xs font-mono font-medium text-foreground">
            {status.branch}
          </span>
          <ChevronDown className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          if (!createMode) {
            focusBranchSearch()
          }
        }}
        className="w-72 overflow-hidden rounded-lg border border-white/10 bg-[hsl(var(--card))] p-0 shadow-xl"
      >
        <div className="border-b border-white/5 p-2">
          {showNewBranchInput ? (
            <div className="flex gap-1">
              <Input
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
                className="h-8 text-xs"
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={handleCreateBranch}
                disabled={!newBranchName.trim()}
                className="h-8 w-8 text-emerald-400 hover:bg-white/5 hover:text-emerald-300"
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setShowNewBranchInput(false)
                  setNewBranchName('')
                  focusBranchSearch()
                }}
                className="h-8 w-8 hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              className="h-8 w-full justify-start gap-2 rounded-md px-2 text-xs text-accent hover:bg-white/5 hover:text-accent"
              onClick={() => setShowNewBranchInput(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              Create new branch
            </Button>
          )}
        </div>

        <Command shouldFilter={false} className="rounded-none bg-transparent text-foreground">
          <CommandInput
            ref={branchSearchInputRef}
            value={branchSearch}
            onValueChange={setBranchSearch}
            placeholder="Search branches..."
            className="h-10 text-xs"
          />
          <CommandList className="max-h-80 p-1.5">
            {filteredLocalBranches.length === 0 && filteredRemoteBranches.length === 0 && (
              <CommandEmpty className="py-3 text-xs text-muted-foreground/60">No branches found</CommandEmpty>
            )}

            {filteredLocalBranches.length > 0 && (
              <CommandGroup heading="Local">
                {filteredLocalBranches.map((branch) => (
                  <CommandItem
                    key={branch.name}
                    value={`local-${branch.name}`}
                    onSelect={() => !branch.current && handleCheckout(branch.name)}
                    disabled={branch.current}
                    className={cn(
                      'gap-1 rounded-md px-2 py-2 text-xs leading-snug data-[selected=true]:bg-white/5 data-[selected=true]:text-foreground',
                      branch.current
                        ? 'text-accent data-[disabled=true]:cursor-default data-[disabled=true]:opacity-100'
                        : 'text-foreground'
                    )}
                  >
                    <Check className={cn('w-3 h-3', !branch.current && 'opacity-0')} />
                    <span>{branch.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {filteredLocalBranches.length > 0 && filteredRemoteBranches.length > 0 && <CommandSeparator />}

            {filteredRemoteBranches.length > 0 && (
              <CommandGroup
                heading="Remote"
                className="px-1 pb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.14em] [&_[cmdk-group-heading]]:text-muted-foreground/60"
              >
                {filteredRemoteBranches.slice(0, 10).map((branch) => (
                  <CommandItem
                    key={branch.name}
                    value={`remote-${branch.name}`}
                    onSelect={() => handleCheckout(branch.name)}
                    className="gap-2 rounded-md px-2 py-2 text-xs leading-snug text-muted-foreground data-[selected=true]:bg-white/5 data-[selected=true]:text-foreground"
                  >
                    <span className="w-3" />
                    <span>{branch.name}</span>
                  </CommandItem>
                ))}
                {filteredRemoteBranches.length > 10 && (
                  <div className="px-3 py-1.5 text-[10px] text-muted-foreground/50">
                    +{filteredRemoteBranches.length - 10} more
                  </div>
                )}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
