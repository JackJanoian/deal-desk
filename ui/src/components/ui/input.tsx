import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground/70 selection:bg-primary/30 selection:text-foreground h-8 w-full min-w-0 rounded-md border border-border/75 bg-card/55 px-2.5 py-1 text-[13px] shadow-[inset_0_1px_0_color-mix(in_oklab,var(--foreground)_4%,transparent)] transition-[color,border-color,box-shadow,background-color] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-[12px] file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-[13px] dark:bg-card/45",
        "focus-visible:border-primary/75 focus-visible:ring-2 focus-visible:ring-primary/25",
        "aria-invalid:ring-destructive/30 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
