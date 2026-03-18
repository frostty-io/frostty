import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  Key,
  Cpu,
  Eye,
  EyeOff,
  PenLine
} from 'lucide-react'
import { Button } from '../ui/button'
import type { AppSettings } from '../../../../shared/ipc'
import { SettingField, INPUT_CLASSES } from './SettingField'

const FREE_MODEL = 'openrouter/free'

type ModelMode = 'free' | 'custom'

interface AISettingsProps {
  settings: AppSettings
  onUpdate: (partial: Partial<AppSettings>) => void
}

export function AISettings({ settings, onUpdate }: AISettingsProps) {
  const [localApiKey, setLocalApiKey] = useState(settings.openRouterApiKey)
  const [localModel, setLocalModel] = useState(settings.openRouterModel)
  const [showApiKey, setShowApiKey] = useState(false)

  const isFree = settings.openRouterModel === FREE_MODEL
  const [modelMode, setModelMode] = useState<ModelMode>(isFree ? 'free' : 'custom')

  useEffect(() => {
    setLocalApiKey(settings.openRouterApiKey)
    setLocalModel(settings.openRouterModel)
    setShowApiKey(false)
    setModelMode(settings.openRouterModel === FREE_MODEL ? 'free' : 'custom')
  }, [settings])

  const handleModeSwitch = (mode: ModelMode) => {
    setModelMode(mode)
    if (mode === 'free') {
      setLocalModel(FREE_MODEL)
      onUpdate({ openRouterModel: FREE_MODEL })
    } else if (localModel === FREE_MODEL) {
      setLocalModel('')
      onUpdate({ openRouterModel: '' })
    }
  }

  return (
    <div className="overflow-y-auto p-8">
      <div className="max-w-xl space-y-8">
        {/* OpenRouter API Key */}
        <SettingField
          label="OpenRouter API Key"
          description={
            <>
              Get your API key from{' '}
              <code className="px-1.5 py-0.5 rounded bg-[hsl(220,15%,16%)] text-[hsl(210,100%,65%)] text-[11px] font-mono">
                openrouter.ai
              </code>
            </>
          }
        >
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Key className="w-4 h-4" />
            </div>
            <input
              type={showApiKey ? 'text' : 'password'}
              value={localApiKey}
              onChange={(e) => {
                setLocalApiKey(e.target.value)
                onUpdate({ openRouterApiKey: e.target.value })
              }}
              placeholder="sk-or-..."
              className={cn(INPUT_CLASSES, 'pl-10 pr-10')}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
        </SettingField>

        {/* Model */}
        <SettingField
          label="Model"
          description={
            modelMode === 'free'
              ? 'Automatically routes to the best available free model on OpenRouter.'
              : 'Enter any OpenRouter model identifier (e.g. anthropic/claude-3.5-sonnet).'
          }
        >
          {/* Mode toggle */}
          <div className="flex gap-1 p-0.5 rounded-lg bg-[hsl(220,15%,13%)] border border-[hsl(220,15%,20%)] mb-3">
            <button
              type="button"
              onClick={() => handleModeSwitch('free')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                modelMode === 'free'
                  ? 'bg-[hsl(220,15%,20%)] text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Cpu className="w-3.5 h-3.5" />
              Free (Auto)
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch('custom')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                modelMode === 'custom'
                  ? 'bg-[hsl(220,15%,20%)] text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <PenLine className="w-3.5 h-3.5" />
              Custom Model
            </button>
          </div>

          {modelMode === 'free' ? (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-[hsl(220,15%,13%)] border border-[hsl(220,15%,20%)] text-sm">
              <Cpu className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-foreground">Free Models Router</span>
              <span className="ml-auto text-xs text-muted-foreground font-mono">{FREE_MODEL}</span>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <PenLine className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={localModel}
                onChange={(e) => {
                  setLocalModel(e.target.value)
                  onUpdate({ openRouterModel: e.target.value })
                }}
                placeholder="provider/model-name"
                className={cn(INPUT_CLASSES, 'pl-10 font-mono text-sm')}
              />
            </div>
          )}
        </SettingField>
      </div>
    </div>
  )
}
