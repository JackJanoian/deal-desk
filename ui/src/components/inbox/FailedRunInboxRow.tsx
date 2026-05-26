import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { RotateCcw, X, XCircle } from "lucide-react";
import type { HeartbeatRun, Issue } from "@dealdesk/shared";
import { timeAgo } from "../../lib/timeAgo";
import { cn } from "../../lib/utils";
import { StatusBadge } from "../StatusBadge";
import { InboxRowChrome } from "./InboxRowChrome";
import {
  readIssueIdFromRun,
  runFailureMessage,
  type NonIssueUnreadState,
} from "./inboxFormatters";

interface FailedRunInboxRowProps {
  run: HeartbeatRun;
  issueById: Map<string, Issue>;
  agentName: string | null;
  issueLinkState: unknown;
  onDismiss: () => void;
  onRetry: () => void;
  isRetrying: boolean;
  unreadState?: NonIssueUnreadState;
  onMarkRead?: () => void;
  onArchive?: () => void;
  archiveDisabled?: boolean;
  selected?: boolean;
  className?: string;
}

export function FailedRunInboxRow({
  run,
  issueById,
  agentName: linkedAgentName,
  issueLinkState: _issueLinkState,
  onDismiss,
  onRetry,
  isRetrying,
  unreadState = null,
  onMarkRead,
  onArchive,
  archiveDisabled,
  selected = false,
  className,
}: FailedRunInboxRowProps) {
  const issueId = readIssueIdFromRun(run);
  const issue = issueId ? issueById.get(issueId) ?? null : null;
  const displayError = runFailureMessage(run);
  const showUnreadSlot = unreadState !== null;

  const dismissButton = !showUnreadSlot ? (
    <button
      type="button"
      onClick={onDismiss}
      className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100 sm:opacity-0"
      aria-label="Dismiss"
    >
      <X className="h-4 w-4" />
    </button>
  ) : null;

  const retryButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 shrink-0 px-2.5"
      onClick={onRetry}
      disabled={isRetrying}
    >
      <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
      {isRetrying ? "Retrying…" : "Retry"}
    </Button>
  );

  return (
    <InboxRowChrome
      unreadState={unreadState}
      onMarkRead={onMarkRead}
      onArchive={onArchive}
      archiveDisabled={archiveDisabled}
      selected={selected}
      className={className}
      body={
        <Link
          to={`/agents/${run.agentId}/runs/${run.id}`}
          className={cn(
            "flex min-w-0 flex-1 items-start gap-2 no-underline text-inherit",
          )}
        >
          {!showUnreadSlot && (
            <span className="hidden h-2 w-2 shrink-0 sm:inline-flex" aria-hidden="true" />
          )}
          <span className="hidden h-3.5 w-3.5 shrink-0 sm:inline-flex" aria-hidden="true" />
          <span className="mt-0.5 shrink-0 rounded-md bg-red-500/15 p-1.5 sm:mt-0">
            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 text-sm font-medium sm:truncate sm:line-clamp-none">
              {issue ? (
                <>
                  <span className="font-mono text-muted-foreground mr-1.5">
                    {issue.identifier ?? issue.id.slice(0, 8)}
                  </span>
                  {issue.title}
                </>
              ) : (
                <>Failed run{linkedAgentName ? ` — ${linkedAgentName}` : ""}</>
              )}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums text-muted-foreground">
              <StatusBadge status={run.status} />
              {linkedAgentName && issue ? <span>{linkedAgentName}</span> : null}
              <span className="truncate max-w-[300px]">{displayError}</span>
              <span>{timeAgo(run.createdAt)}</span>
            </span>
          </span>
        </Link>
      }
      desktopActions={retryButton}
      desktopDismissButton={dismissButton ?? undefined}
      mobileActions={retryButton}
      mobileDismissButton={dismissButton ?? undefined}
    />
  );
}
