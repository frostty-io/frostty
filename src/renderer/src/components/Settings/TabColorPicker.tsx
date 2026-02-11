import { useRef, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Check, Pipette } from 'lucide-react'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '../ui/popover'
import { Label } from '../ui/label'
import { Input } from '../ui/input'
import { SettingField } from './SettingField'

/** Curated preset colors for the tab color picker. */
export const PRESET_TAB_COLORS: { color: string; label: string }[] = [
  { color: '#3b82f6', label: 'Blue' },
  { color: '#ef4444', label: 'Red' },
  { color: '#f97316', label: 'Orange' },
  { color: '#f59e0b', label: 'Amber' },
  { color: '#22c55e', label: 'Green' },
  { color: '#10b981', label: 'Emerald' },
  { color: '#14b8a6', label: 'Teal' },
  { color: '#06b6d4', label: 'Cyan' },
  { color: '#6366f1', label: 'Indigo' },
  { color: '#8b5cf6', label: 'Violet' },
  { color: '#a855f7', label: 'Purple' },
  { color: '#ec4899', label: 'Pink' },
  { color: '#f43f5e', label: 'Rose' },
]

function normalizeHex(value: string): string {
  const hex = value.replace(/^#/, '').trim()
  if (/^[0-9A-Fa-f]{6}$/.test(hex)) return '#' + hex
  if (/^[0-9A-Fa-f]{3}$/.test(hex)) {
    const r = hex[0] + hex[0]
    const g = hex[1] + hex[1]
    const b = hex[2] + hex[2]
    return '#' + r + g + b
  }
  return value
}

function isValidHex(value: string): boolean {
  const hex = value.replace(/^#/, '').trim()
  return /^[0-9A-Fa-f]{3}$/.test(hex) || /^[0-9A-Fa-f]{6}$/.test(hex)
}

export function TabColorPicker({
  color,
  onChange
}: {
  color: string
  onChange: (color: string) => void
}) {
  const nativeInputRef = useRef<HTMLInputElement>(null)
  const [hexInput, setHexInput] = useState(color)
  const isPreset = PRESET_TAB_COLORS.some(p => p.color.toLowerCase() === color.toLowerCase())

  // Keep hex input in sync when color changes from outside (e.g. preset click)
  useEffect(() => {
    setHexInput(color)
  }, [color])

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setHexInput(raw)
    if (isValidHex(raw)) {
      onChange(normalizeHex(raw))
    }
  }

  const handleHexBlur = () => {
    if (!isValidHex(hexInput)) {
      setHexInput(color)
    } else {
      setHexInput(normalizeHex(hexInput))
    }
  }

  const handleNativeColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    onChange(next)
    setHexInput(next)
  }

  // Native color input lives here so it stays mounted when popover is closed (custom swatch can open picker).
  const nativeColorInput = (
    <input
      ref={nativeInputRef}
      type="color"
      value={color}
      onChange={handleNativeColorChange}
      className="sr-only absolute opacity-0 pointer-events-none w-0 h-0"
      aria-hidden
      tabIndex={-1}
    />
  )

  return (
    <SettingField
      label="Tab Color"
      description="Choose a color for the tab border when this profile is active."
    >
      {nativeColorInput}
      <div className="flex flex-wrap items-center gap-2">
        {/* Preset swatches (square) */}
        {PRESET_TAB_COLORS.map((preset) => {
          const isSelected =
            color.toLowerCase() === preset.color.toLowerCase()
          return (
            <button
              key={preset.color}
              type="button"
              title={preset.label}
              onClick={() => onChange(preset.color)}
              className={cn(
                'w-8 h-8 rounded-lg border-2 transition-all duration-150 flex items-center justify-center',
                'hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(210,100%,55%)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(220,15%,8%)]',
                isSelected
                  ? 'border-white/80 scale-105'
                  : 'border-transparent hover:border-white/30'
              )}
              style={{ backgroundColor: preset.color }}
            >
              {isSelected && (
                <Check className="w-4 h-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
              )}
            </button>
          )
        })}

        {/* Custom color swatch when not a preset */}
        {!isPreset && (
          <button
            type="button"
            title={`Custom: ${color}`}
            onClick={() => nativeInputRef.current?.click()}
            className="w-8 h-8 rounded-lg border-2 border-white/80 scale-105 transition-all duration-150 flex items-center justify-center"
            style={{ backgroundColor: color }}
          >
            <Check className="w-4 h-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
          </button>
        )}

        <div className="w-px h-5 bg-[hsl(220,15%,20%)] mx-0.5" />

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="Pick a custom color"
              className={cn(
                'w-8 h-8 rounded-lg border-2 border-dashed transition-all duration-150',
                'flex items-center justify-center',
                'border-[hsl(220,15%,25%)] hover:border-[hsl(220,15%,42%)]',
                'bg-[hsl(220,15%,11%)] hover:bg-[hsl(220,15%,16%)]',
                'hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(210,100%,55%)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(220,15%,8%)]'
              )}
            >
              <Pipette className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent
                align="start"
                sideOffset={8}
                className="w-64 p-0 overflow-hidden rounded-xl border-[hsl(220,15%,20%)] bg-[hsl(220,15%,10%)] shadow-xl shadow-black/40"
              >
                <div className="p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => nativeInputRef.current?.click()}
                      className="w-14 h-14 rounded-xl border-2 border-[hsl(220,15%,22%)] shrink-0 shadow-inner overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(210,100%,55%)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(220,15%,10%)] transition-shadow hover:shadow-md"
                      style={{ backgroundColor: color }}
                      aria-label="Open color picker"
                    />
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <Label className="text-xs font-medium text-muted-foreground">
                        Custom color
                      </Label>
                      <p className="text-sm font-mono text-foreground uppercase tabular-nums tracking-wide">
                        {color}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tab-color-hex" className="text-xs font-medium text-muted-foreground">
                      Hex
                    </Label>
                    <Input
                      id="tab-color-hex"
                      type="text"
                      value={hexInput}
                      onChange={handleHexChange}
                      onBlur={handleHexBlur}
                      placeholder="#3b82f6"
                      className="h-9 font-mono text-sm bg-[hsl(220,15%,12%)] border-[hsl(220,15%,22%)] focus-visible:ring-[hsl(210,100%,55%)]/40"
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
      </div>
    </SettingField>
  )
}
