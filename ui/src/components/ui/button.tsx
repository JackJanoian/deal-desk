import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-[13px] font-medium tracking-[-0.005em] transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-ring/45 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px aria-invalid:ring-destructive/30 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "border border-primary/80 bg-primary text-primary-foreground shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_22%,transparent),0_10px_28px_color-mix(in_oklab,var(--primary)_16%,transparent)] hover:bg-primary/92 hover:shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_30%,transparent),0_12px_34px_color-mix(in_oklab,var(--primary)_20%,transparent)]",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/40",
        outline:
          "border border-border/75 bg-card/55 shadow-[inset_0_1px_0_color-mix(in_oklab,var(--foreground)_5%,transparent)] hover:bg-accent hover:text-accent-foreground hover:border-primary/35 dark:bg-card/45",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/45",
        ghost:
          "hover:bg-accent/80 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-3 py-1 has-[>svg]:px-2.5",
        xs: "h-6 gap-1 rounded-md px-2 text-[11px] has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 rounded-md gap-1.5 px-2.5 text-[12px] has-[>svg]:px-2",
        lg: "h-9 rounded-md px-5 has-[>svg]:px-4",
        icon: "size-8",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean
    }
>(function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}, ref) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      ref={ref}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
})

Button.displayName = "Button"

export { Button, buttonVariants }
