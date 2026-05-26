import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import type { Approval } from "@dealdesk/shared";
import { timeAgo } from "../../lib/timeAgo";
import { ACTIONABLE_APPROVAL_STATUSES } from "../../lib/inbox";
import { approvalLabel, defaultTypeIcon, typeIcon } from "../ApprovalPayload";
import { InboxRowChrome } from "./InboxRowChrome";
import { approvalStatusLabel, type NonIssueUnreadState } from "./inboxFormatters";

interface ApprovalInboxRowProps {
  approval: Approval;
  requesterName: string | null;
  onApprove: () => void;
  onReject: () => void;
  isPending: boolean;
  unreadState?: NonIssueUnreadState;
  onMarkRead?: () => void;
  onArchive?: () => void;
  archiveDisabled?: boolean;
  selected?: boolean;
  className?: string;
}

export function ApprovalInboxRow({
  approval,
  requesterName,
  onApprove,
  onReject,
  isPending,
  unreadState = null,
  onMarkRead,
  onArchive,
  archiveDisabled,
  selected = false,
  className,
}: ApprovalInboxRowProps) {
  const Icon = typeIcon[approval.type] ?? defaultTypeIcon;
  const label = approvalLabel(approval.type, approval.payload as Record<string, unknown> | null);
  const showResolutionButtons =
    approval.type !== "budget_override_required" &&
    ACTIONABLE_APPROVAL_STATUSES.has(approval.status);
  const showUnreadSlot = unreadState !== null;

  const actions = showResolutionButtons ? (
    <>
      <Button
        size="sm"
        className="h-8 bg-green-700 px-3 text-white hover:bg-green-600"
        onClick={onApprove}
        disabled={isPending}
      >
        Approve
      </Button>
      <Button
        variant="destructive"
        size="sm"
        className="h-8 px-3"
        onClick={onReject}
        disabled={isPending}
      >
        Reject
      </Button>
    </>
  ) : null;

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
          to={`/approvals/${approval.id}`}
          className="flex min-w-0 flex-1 items-start gap-2 no-underline text-inherit"
        >
          {!showUnreadSlot && (
            <span className="hidden h-2 w-2 shrink-0 sm:inline-flex" aria-hidden="true" />
          )}
          <span className="hidden h-3.5 w-3.5 shrink-0 sm:inline-flex" aria-hidden="true" />
          <span className="mt-0.5 shrink-0 rounded-md bg-muted p-1.5 sm:mt-0">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 text-sm font-medium sm:truncate sm:line-clamp-none">
              {label}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums text-muted-foreground">
              <span className="capitalize">{approvalStatusLabel(approval.status)}</span>
              {requesterName ? <span>requested by {requesterName}</span> : null}
              <span>updated {timeAgo(approval.updatedAt)}</span>
            </span>
          </span>
        </Link>
      }
      desktopActions={actions ?? undefined}
      mobileActions={actions ?? undefined}
    />
  );
}
