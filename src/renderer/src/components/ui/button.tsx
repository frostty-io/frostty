import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[hsl(220,15%,14%)] hover:bg-[hsl(220,15%,18%)] border border-[hsl(220,15%,22%)] text-foreground/90 hover:text-foreground",
        secondary:
          "bg-white/5 hover:bg-accent/10 border border-white/5 text-muted-foreground hover:text-accent",
        destructive:
          "bg-destructive/10 hover:bg-destructive/20 border border-destructive/30 text-destructive",
        accent:
          "bg-accent/10 hover:bg-accent/20 border border-accent/30 text-accent",
        outline:
          "bg-transparent border border-[hsl(220,15%,22%)] hover:bg-[hsl(220,15%,12%)] hover:border-[hsl(220,15%,30%)] text-muted-foreground hover:text-foreground",
        ghost:
          "hover:bg-white/5 text-muted-foreground hover:text-foreground",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
