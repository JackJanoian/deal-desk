import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { listRowSelectedClass, listRowHoverClass } from "../../lib/list-row-styles";
import type { NonIssueUnreadState } from "./inboxFormatters";

/**
 * Shared chrome for non-issue inbox rows (approvals, failed runs, join requests).
 * Provides the unread/dismiss slot on the left, the row body in the middle,
 * trailing actions on the right, and a mobile-only action drawer at the bottom.
 */
interface InboxRowChromeProps {
  unreadState: NonIssueUnreadState;
  onMarkRead?: () => void;
  onArchive?: () => void;
  archiveDisabled?: boolean;
  selected?: boolean;
  className?: string;
  /** Main row body (link wrapper + content). */
  body: ReactNode;
  /** Desktop action buttons shown to the right (e.g. Approve / Reject). */
  desktopActions?: ReactNode;
  /** Mobile-only action drawer rendered below the row content. */
  mobileActions?: ReactNode;
  /** Legacy dismiss-on-hover button on desktop (failed runs only). */
  desktopDismissButton?: ReactNode;
  /** Legacy dismiss button on mobile drawer (failed runs only). */
  mobileDismissButton?: ReactNode;
}

export function InboxRowChrome({
  unreadState,
  onMarkRead,
  onArchive,
  archiveDisabled,
  selected = false,
  className,
  body,
  desktopActions,
  mobileActions,
  desktopDismissButton,
  mobileDismissButton,
}: InboxRowChromeProps) {
  const showUnreadSlot = unreadState !== null;
  const showUnreadDot = unreadState === "visible" || unreadState === "fading";

  return (
    <div
      className={cn(
        "group px-2 py-2.5 sm:px-1 sm:pr-3 sm:py-2",
        selected ? listRowSelectedClass : listRowHoverClass,
        className,
      )}
    >
      <div className="flex items-start gap-2 sm:items-center">
        {showUnreadSlot ? (
          <span className="hidden sm:inline-flex h-4 w-4 shrink-0 items-center justify-center self-center">
            {showUnreadDot ? (
              <button
                type="button"
                onClick={onMarkRead}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:bg-primary/20"
                aria-label="Mark as read"
              >
                <span
                  className={cn(
                    "block h-1.5 w-1.5 rounded-full bg-primary transition-opacity duration-300",
                    unreadState === "fading" ? "opacity-0" : "opacity-100",
                  )}
                />
              </button>
            ) : onArchive ? (
              <button
                type="button"
                onClick={onArchive}
                disabled={archiveDisabled}
                className="inline-flex h-4 w-4 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 disabled:pointer-events-none disabled:opacity-30"
                aria-label="Dismiss from inbox"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <span className="inline-flex h-4 w-4" aria-hidden="true" />
            )}
          </span>
        ) : null}
        {body}
        {desktopActions ? (
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            {desktopActions}
            {desktopDismissButton}
          </div>
        ) : desktopDismissButton ? (
          <div className="hidden shrink-0 items-center gap-2 sm:flex">{desktopDismissButton}</div>
        ) : null}
      </div>
      {mobileActions ? (
        <div className="mt-3 flex gap-2 sm:hidden">
          {mobileActions}
          {mobileDismissButton}
        </div>
      ) : mobileDismissButton ? (
        <div className="mt-3 flex gap-2 sm:hidden">{mobileDismissButton}</div>
      ) : null}
    </div>
  );
}
