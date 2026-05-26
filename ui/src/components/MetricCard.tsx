import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  description?: ReactNode;
  to?: string;
  onClick?: () => void;
}

export function MetricCard({ icon: Icon, value, label, description, to, onClick }: MetricCardProps) {
  const isClickable = !!(to || onClick);

  const inner = (
    <div
      className={cn(
        "dd-panel-subtle h-full rounded-lg px-4 py-4 transition-[background-color,border-color,box-shadow,transform] sm:px-5 sm:py-4",
        isClickable &&
          "cursor-pointer hover:-translate-y-px hover:border-primary/35 hover:bg-accent/35 hover:shadow-[0_14px_34px_color-mix(in_oklab,var(--foreground)_8%,transparent)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="dd-kicker">
            {label}
          </p>
          <p className="text-[22px] sm:text-[24px] font-semibold tracking-[-0.015em] tabular-nums mt-1.5 leading-none">
            {value}
          </p>
          {description && (
            <div className="text-[11.5px] text-muted-foreground mt-2 hidden sm:block">{description}</div>
          )}
        </div>
        <span className="rounded-md border border-border/70 bg-card/50 p-1.5 text-muted-foreground/70">
          <Icon className="h-3.5 w-3.5 shrink-0" />
        </span>
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="no-underline text-inherit h-full" onClick={onClick}>
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <div className="h-full" onClick={onClick}>
        {inner}
      </div>
    );
  }

  return inner;
}
