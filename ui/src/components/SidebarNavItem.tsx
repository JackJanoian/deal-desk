import { NavLink } from "@/lib/router";
import { SIDEBAR_SCROLL_RESET_STATE } from "../lib/navigation-scroll";
import { cn } from "../lib/utils";
import { useSidebar } from "../context/SidebarContext";
import type { LucideIcon } from "lucide-react";

interface SidebarNavItemProps {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  className?: string;
  badge?: number;
  badgeTone?: "default" | "danger";
  textBadge?: string;
  textBadgeTone?: "default" | "amber";
  alert?: boolean;
  liveCount?: number;
}

export function SidebarNavItem({
  to,
  label,
  icon: Icon,
  end,
  className,
  badge,
  badgeTone = "default",
  textBadge,
  textBadgeTone = "default",
  alert = false,
  liveCount,
}: SidebarNavItemProps) {
  const { isMobile, setSidebarOpen } = useSidebar();

  return (
    <NavLink
      to={to}
      state={SIDEBAR_SCROLL_RESET_STATE}
      end={end}
      onClick={() => { if (isMobile) setSidebarOpen(false); }}
      className={({ isActive }) =>
        cn(
          "dd-interactive relative flex items-center gap-2.5 rounded-md border border-transparent px-3 py-1.5 text-[12.5px] font-medium",
          // Controlled active state: selected wash + compact teal spine.
          isActive
            ? "border-primary/25 bg-primary/10 text-foreground shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_10%,transparent)] before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[2px] before:bg-primary before:rounded-full"
            : "text-foreground/72 hover:bg-sidebar-accent/70 hover:text-foreground",
          className,
        )
      }
    >
      <span className="relative shrink-0">
        <Icon className="h-4 w-4" />
        {alert && (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 shadow-[0_0_0_2px_var(--background)]" />
        )}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {textBadge && (
        <span
          className={cn(
            "ml-auto rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none",
            textBadgeTone === "amber"
              ? "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              : "border-border/70 bg-muted/70 text-muted-foreground",
          )}
        >
          {textBadge}
        </span>
      )}
      {liveCount != null && liveCount > 0 && (
        <span className="ml-auto flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
          </span>
          <span className="text-[11px] font-medium text-primary">{liveCount} live</span>
        </span>
      )}
      {badge != null && badge > 0 && (
        <span
          className={cn(
            "ml-auto rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular-nums",
            badgeTone === "danger"
              ? "border-red-500/25 bg-red-500/15 text-red-400"
              : "border-primary/25 bg-primary/15 text-primary",
          )}
        >
          {badge}
        </span>
      )}
    </NavLink>
  );
}
