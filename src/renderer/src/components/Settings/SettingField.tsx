import { cn } from '@/lib/utils'

/** Consistent wrapper for a single setting field. */
export function SettingField({
  label,
  description,
  children
}: {
  label: string
  description?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2.5">
      <div>
        <label className="text-sm font-medium text-foreground">{label}</label>
        {description && (
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}

// Shared input classes
export const INPUT_CLASSES = cn(
  'w-full h-10 rounded-lg',
  'bg-[hsl(220,15%,10%)] border border-[hsl(220,15%,20%)]',
  'text-sm text-foreground placeholder:text-muted-foreground font-mono',
  'outline-none focus:ring-2 focus:ring-[hsl(210,100%,55%)]/40 focus:border-[hsl(210,100%,55%)]',
  'transition-all duration-150'
)
