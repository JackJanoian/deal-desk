import { type ReactNode } from "react";
import { Link } from "@/lib/router";
import { cn } from "../lib/utils";

interface EntityRowProps {
  leading?: ReactNode;
  identifier?: string;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  selected?: boolean;
  to?: string;
  onClick?: () => void;
  className?: string;
}

export function EntityRow({
  leading,
  identifier,
  title,
  subtitle,
  trailing,
  selected,
  to,
  onClick,
  className,
}: EntityRowProps) {
  const isClickable = !!(to || onClick);
  const classes = cn(
    "flex items-center gap-3 border-b border-border/60 px-4 py-2 text-[13px] transition-[background-color,border-color,box-shadow] last:border-b-0",
    isClickable && "cursor-pointer hover:bg-accent/35",
    selected && "bg-primary/10 shadow-[inset_2px_0_0_var(--primary)]",
    className
  );

  const content = (
    <>
      {leading && <div className="flex items-center gap-2 shrink-0">{leading}</div>}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {identifier && (
            <span className="shrink-0 font-mono text-xs text-muted-foreground relative top-[1px]">
              {identifier}
            </span>
          )}
          <span className="truncate text-foreground/92">{title}</span>
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p>
        )}
      </div>
      {trailing && <div className="flex items-center gap-2 shrink-0">{trailing}</div>}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={cn(classes, "no-underline text-inherit")} onClick={onClick}>
        {content}
      </Link>
    );
  }

  return (
    <div className={classes} onClick={onClick}>
      {content}
    </div>
  );
}
