import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Optional small label rendered above the title (kicker style). */
  eyebrow?: ReactNode;
  /** Right-aligned actions: buttons, links, dropdowns. */
  actions?: ReactNode;
  /** Render below the header (e.g. tabs, filter pills). */
  below?: ReactNode;
  className?: string;
}

/**
 * Standard page header used at the top of major screens. Provides a single
 * title hierarchy so individual sections can stay quiet and consistent.
 */
export function PageHeader({ title, description, eyebrow, actions, below, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <p className="dd-kicker mb-1.5">{eyebrow}</p>
          ) : null}
          <h1 className="text-xl font-semibold tracking-[-0.01em] text-foreground">{title}</h1>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {below ? <div>{below}</div> : null}
    </div>
  );
}
