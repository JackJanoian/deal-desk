import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("relative overflow-hidden rounded-md bg-accent/55 before:absolute before:inset-0 before:-translate-x-full before:animate-[skeleton-sweep_1.6s_ease-in-out_infinite] before:bg-gradient-to-r before:from-transparent before:via-foreground/7 before:to-transparent", className)}
      {...props}
    />
  )
}

export { Skeleton }
