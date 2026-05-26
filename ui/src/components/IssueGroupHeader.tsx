import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";

type IssueGroupHeaderProps = {
  label: string;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
  trailing?: ReactNode;
  className?: string;
};

export function IssueGroupHeader({
  label,
  collapsible = false,
  collapsed = false,
  onToggle,
  trailing,
  className,
}: IssueGroupHeaderProps) {
  return (
    <div className={cn("flex items-center rounded-md bg-muted/25 px-2 py-1.5", className)}>
      {collapsible ? (
        <button
          type="button"
          className="flex min-w-0 items-center gap-1.5 text-left"
          aria-expanded={!collapsed}
          onClick={onToggle}
        >
          <ChevronRight
            className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", !collapsed && "rotate-90")}
          />
          <span className="dd-kicker truncate">
            {label}
          </span>
        </button>
      ) : (
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="dd-kicker truncate">
            {label}
          </span>
        </div>
      )}
      {trailing ? <div className="ml-auto">{trailing}</div> : null}
    </div>
  );
}
