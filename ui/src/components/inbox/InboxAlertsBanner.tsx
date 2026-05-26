import { Link } from "@/lib/router";
import { AlertTriangle, X } from "lucide-react";
import type { DashboardSummary } from "@dealdesk/shared";
import { ListSurface } from "../ListSurface";

interface InboxAlertsBannerProps {
  dashboard: DashboardSummary;
  /** When true, show the aggregate agent-error alert. Caller passes the precomputed visibility. */
  showAgentError: boolean;
  /** When true, show the budget utilization alert. */
  showBudgetAlert: boolean;
  onDismissAgentError: () => void;
  onDismissBudgetAlert: () => void;
}

/**
 * Banner shown directly under the inbox toolbar (on the All tab) for
 * company-wide alerts: agent errors and budget utilization warnings.
 * Each alert is independently dismissible via localStorage on the parent.
 */
export function InboxAlertsBanner({
  dashboard,
  showAgentError,
  showBudgetAlert,
  onDismissAgentError,
  onDismissBudgetAlert,
}: InboxAlertsBannerProps) {
  if (!showAgentError && !showBudgetAlert) return null;

  return (
    <ListSurface>
      {showAgentError && (
        <div className="group/alert relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/30">
          <Link
            to="/agents"
            className="flex flex-1 cursor-pointer items-center gap-3 no-underline text-inherit"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            <span className="text-sm">
              <span className="font-medium">{dashboard.agents.error}</span>{" "}
              {dashboard.agents.error === 1 ? "agent has" : "agents have"} errors
            </span>
          </Link>
          <button
            type="button"
            onClick={onDismissAgentError}
            className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover/alert:opacity-100"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {showBudgetAlert && (
        <div className="group/alert relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/30">
          <Link
            to="/costs"
            className="flex flex-1 cursor-pointer items-center gap-3 no-underline text-inherit"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-500 dark:text-yellow-400" />
            <span className="text-sm">
              Budget at{" "}
              <span className="font-medium">{dashboard.costs.monthUtilizationPercent}%</span>{" "}
              utilization this month
            </span>
          </Link>
          <button
            type="button"
            onClick={onDismissBudgetAlert}
            className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover/alert:opacity-100"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </ListSurface>
  );
}
