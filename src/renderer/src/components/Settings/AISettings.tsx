import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  Key,
  Cpu,
  Eye,
  EyeOff,
  ChevronDown,
  Check
} from 'lucide-react'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../ui/dropdown-menu'
import type { AppSettings } from '../../../../shared/ipc'
import { SettingField, INPUT_CLASSES } from './SettingField'

/** Free models available on OpenRouter. */
const FREE_MODELS: { value: string; label: string }[] = [
  { value: 'openrouter/free', label: 'Free Models Router (auto)' },
  { value: 'openrouter/pony-alpha', label: 'Pony Alpha' },
  { value: 'openai/gpt-oss-120b', label: 'OpenAI: gpt-oss-120b' },
  { value: 'openai/gpt-oss-20b', label: 'OpenAI: gpt-oss-20b' },
  { value: 'qwen/qwen3-coder', label: 'Qwen3 Coder 480B A35B' },
  { value: 'qwen/qwen3-next-80b-a3b-instruct', label: 'Qwen3 Next 80B A3B Instruct' },
  { value: 'qwen/qwen3-4b', label: 'Qwen3 4B' },
  { value: 'meta-llama/llama-3.3-70b-instruct', label: 'Meta: Llama 3.3 70B Instruct' },
  { value: 'google/gemma-3-27b-it', label: 'Google: Gemma 3 27B' },
  { value: 'mistralai/mistral-small-3.1-24b-instruct', label: 'Mistral: Mistral Small 3.1 24B' },
  { value: 'arcee-ai/trinity-large-preview', label: 'Arcee AI: Trinity Large Preview' },
  { value: 'arcee-ai/trinity-mini', label: 'Arcee AI: Trinity Mini' },
  { value: 'tngtech/tng-r1t-chimera', label: 'TNG: R1T Chimera' },
  { value: 'stepfun/step-3.5-flash', label: 'StepFun: Step 3.5 Flash' },
  { value: 'z-ai/glm-4.5-air', label: 'Z.AI: GLM 4.5 Air' },
  { value: 'nvidia/nemotron-3-nano-30b-a3b', label: 'NVIDIA: Nemotron 3 Nano 30B A3B' },
  { value: 'nvidia/nemotron-nano-12b-v2-vl', label: 'NVIDIA: Nemotron Nano 12B V2 VL' },
  { value: 'nvidia/nemotron-nano-9b-v2', label: 'NVIDIA: Nemotron Nano 9B V2' },
  { value: 'upstage/solar-pro-3', label: 'Upstage: Solar Pro 3' },
  { value: 'liquid/lfm-2.5-1.2b-thinking', label: 'LiquidAI: LFM2.5-1.2B-Thinking' },
  { value: 'liquid/lfm-2.5-1.2b-instruct', label: 'LiquidAI: LFM2.5-1.2B-Instruct' },
]

interface AISettingsProps {
  settings: AppSettings
  onUpdate: (partial: Partial<AppSettings>) => void
}

export function AISettings({ settings, onUpdate }: AISettingsProps) {
  const [localApiKey, setLocalApiKey] = useState(settings.openRouterApiKey)
  const [localModel, setLocalModel] = useState(settings.openRouterModel)
  const [showApiKey, setShowApiKey] = useState(false)

  // Sync local state when props change
  useEffect(() => {
    setLocalApiKey(settings.openRouterApiKey)
    setLocalModel(settings.openRouterModel)
    setShowApiKey(false)
  }, [settings])

  const getModelLabel = (modelId: string): string => {
    const model = FREE_MODELS.find(m => m.value === modelId)
    return model?.label || modelId || 'Select a model'
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
          description="Select a free model from OpenRouter for AI command generation."
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between bg-popover border-[hsl(220,15%,20%)] hover:bg-popover hover:border-[hsl(220,15%,28%)]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Cpu className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="truncate text-foreground">{getModelLabel(localModel)}</span>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="min-w-(--radix-dropdown-menu-trigger-width) max-h-64"
            >
              {FREE_MODELS.map((model) => {
                const isSelected = localModel === model.value
                return (
                  <DropdownMenuItem
                    key={model.value}
                    onClick={() => {
                      setLocalModel(model.value)
                      onUpdate({ openRouterModel: model.value })
                    }}
                    className={cn(
                      'gap-3 py-2.5 cursor-pointer',
                      isSelected && 'bg-accent/10'
                    )}
                  >
                    <div className="w-4 h-4 flex items-center justify-center shrink-0">
                      {isSelected && <Check className="w-4 h-4 text-accent" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-foreground truncate">{model.label}</div>
                      <div className="text-xs text-muted-foreground font-mono truncate">
                        {model.value}
                      </div>
                    </div>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </SettingField>
      </div>
    </div>
  )
}
