import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border border-transparent px-1.5 py-0.5 text-[10.5px] font-medium tracking-[0.02em] w-fit whitespace-nowrap shrink-0 [&>svg]:size-2.5 gap-1 [&>svg]:pointer-events-none focus-visible:ring-ring/50 focus-visible:ring-2 aria-invalid:ring-destructive/30 aria-invalid:border-destructive transition-[color,background-color,border-color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_24%,transparent)] [a&]:hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "bg-destructive/15 text-destructive border-destructive/20 [a&]:hover:bg-destructive/20 dark:bg-destructive/20 dark:text-destructive-foreground",
        outline:
          "border-border/70 bg-card/35 text-foreground/85 [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
