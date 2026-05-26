import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";

interface StatInlineProps {
  icon?: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  to?: string;
  onClick?: () => void;
  /** Subtle accent color shown on the value (uses a token-friendly class). */
  tone?: "default" | "warning" | "danger" | "success";
}

const toneClass: Record<NonNullable<StatInlineProps["tone"]>, string> = {
  default: "text-foreground",
  warning: "text-amber-600 dark:text-amber-300",
  danger: "text-red-600 dark:text-red-300",
  success: "text-emerald-600 dark:text-emerald-300",
};

/**
 * Compact horizontal stat used in the Dashboard header strip and other
 * dense summaries. Smaller than MetricCard, optimized for a single row.
 */
export function StatInline({ icon: Icon, label, value, hint, to, onClick, tone = "default" }: StatInlineProps) {
  const clickable = !!(to || onClick);
  const inner = (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-3 transition-colors min-w-0",
        clickable && "cursor-pointer hover:bg-accent/30",
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon ? (
          <span className="rounded-md border border-border/70 bg-card/50 p-1.5 text-muted-foreground/80">
            <Icon className="h-3.5 w-3.5" />
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          {hint ? (
            <p className="truncate text-[11px] text-muted-foreground/70">{hint}</p>
          ) : null}
        </div>
      </div>
      <p className={cn("shrink-0 text-base font-semibold tabular-nums tracking-[-0.01em] leading-none", toneClass[tone])}>
        {value}
      </p>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="block no-underline text-inherit" onClick={onClick}>
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block w-full text-left">
        {inner}
      </button>
    );
  }

  return inner;
}
