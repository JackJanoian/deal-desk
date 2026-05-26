import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import type { JoinRequest } from "@dealdesk/shared";
import { timeAgo } from "../../lib/timeAgo";
import { InboxRowChrome } from "./InboxRowChrome";
import { formatJoinRequestInboxLabel, type NonIssueUnreadState } from "./inboxFormatters";

interface JoinRequestInboxRowProps {
  joinRequest: JoinRequest;
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

export function JoinRequestInboxRow({
  joinRequest,
  onApprove,
  onReject,
  isPending,
  unreadState = null,
  onMarkRead,
  onArchive,
  archiveDisabled,
  selected = false,
  className,
}: JoinRequestInboxRowProps) {
  const label = formatJoinRequestInboxLabel(joinRequest);
  const showUnreadSlot = unreadState !== null;

  const actions = (
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
        <div className="flex min-w-0 flex-1 items-start gap-2">
          {!showUnreadSlot && (
            <span className="hidden h-2 w-2 shrink-0 sm:inline-flex" aria-hidden="true" />
          )}
          <span className="hidden h-3.5 w-3.5 shrink-0 sm:inline-flex" aria-hidden="true" />
          <span className="mt-0.5 shrink-0 rounded-md bg-muted p-1.5 sm:mt-0">
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 text-sm font-medium sm:truncate sm:line-clamp-none">
              {label}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums text-muted-foreground">
              <span>requested {timeAgo(joinRequest.createdAt)} from IP {joinRequest.requestIp}</span>
              {joinRequest.adapterType && <span>adapter: {joinRequest.adapterType}</span>}
            </span>
          </span>
        </div>
      }
      desktopActions={actions}
      mobileActions={actions}
    />
  );
}
