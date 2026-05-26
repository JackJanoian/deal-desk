import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ListSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Drop the divider between children when the contents render their own separators. */
  withoutDividers?: boolean;
  /** Use a less-prominent border + transparent background; suits embedded lists. */
  subtle?: boolean;
}

/**
 * Linear-style flat list surface. Wraps a vertical stack of rows with a
 * single rounded border, soft background, and optional divider lines so
 * row components stay free of duplicated chrome.
 */
export function ListSurface({
  children,
  withoutDividers,
  subtle,
  className,
  ...rest
}: ListSurfaceProps) {
  return (
    <div
      {...rest}
      className={cn(
        "overflow-hidden rounded-lg border",
        subtle
          ? "border-border/60 bg-card/20"
          : "border-border/70 bg-card/40",
        !withoutDividers && "divide-y divide-border/60",
        className,
      )}
    >
      {children}
    </div>
  );
}
