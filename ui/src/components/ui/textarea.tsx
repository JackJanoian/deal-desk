import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-border/70 placeholder:text-muted-foreground/70 focus-visible:border-primary/70 focus-visible:ring-primary/25 aria-invalid:ring-destructive/30 aria-invalid:border-destructive bg-background dark:bg-card/40 flex field-sizing-content min-h-16 w-full rounded-md border px-2.5 py-1.5 text-[13px] leading-[1.55] transition-[color,border-color,box-shadow] outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-[13px]",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
