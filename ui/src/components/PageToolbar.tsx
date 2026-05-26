import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageToolbarProps {
  leading?: ReactNode;
  center?: ReactNode;
  trailing?: ReactNode;
  /** When true, the center slot fills available space (e.g. for a search field). */
  centerGrows?: boolean;
  className?: string;
}

/**
 * Compact 40px toolbar with three slots. Inspired by Linear's view header:
 * tabs/title on the left, optional search or filters in the center,
 * icon actions on the right.
 */
export function PageToolbar({ leading, center, trailing, centerGrows = true, className }: PageToolbarProps) {
  return (
    <div
      className={cn(
        "flex h-10 items-center gap-2",
        className,
      )}
    >
      {leading ? <div className="flex shrink-0 items-center gap-2">{leading}</div> : null}
      {center ? (
        <div className={cn("flex items-center gap-2 min-w-0", centerGrows && "flex-1")}>
          {center}
        </div>
      ) : centerGrows ? (
        <div className="flex-1" />
      ) : null}
      {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
    </div>
  );
}
