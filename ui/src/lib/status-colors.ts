/**
 * Canonical status & priority color definitions.
 *
 * Every component that renders a status indicator (StatusIcon, StatusBadge,
 * agent status dots, etc.) should import from here so colors stay consistent.
 */

// ---------------------------------------------------------------------------
// Issue status colors
// ---------------------------------------------------------------------------

/** StatusIcon circle: text + border classes */
export const issueStatusIcon: Record<string, string> = {
  backlog: "text-muted-foreground border-muted-foreground",
  todo: "text-blue-600 border-blue-600 dark:text-blue-400 dark:border-blue-400",
  in_progress: "text-yellow-600 border-yellow-600 dark:text-yellow-400 dark:border-yellow-400",
  in_review: "text-violet-600 border-violet-600 dark:text-violet-400 dark:border-violet-400",
  done: "text-green-600 border-green-600 dark:text-green-400 dark:border-green-400",
  cancelled: "text-neutral-500 border-neutral-500",
  blocked: "text-red-600 border-red-600 dark:text-red-400 dark:border-red-400",
};

export const issueStatusIconDefault = "text-muted-foreground border-muted-foreground";

/** Filled StatusIcon backgrounds for terminal / attention states (done, blocked). */
export const issueStatusIconFill: Record<string, string> = {
  done: "bg-green-600 dark:bg-green-500",
  blocked: "bg-red-600 dark:bg-red-500",
};

export const issueStatusIconFillMuted = "bg-muted-foreground text-background";

/** Text-only color for issue statuses (dropdowns, labels) */
export const issueStatusText: Record<string, string> = {
  backlog: "text-muted-foreground",
  todo: "text-blue-600 dark:text-blue-400",
  in_progress: "text-yellow-600 dark:text-yellow-400",
  in_review: "text-violet-600 dark:text-violet-400",
  done: "text-green-600 dark:text-green-400",
  cancelled: "text-neutral-500",
  blocked: "text-red-600 dark:text-red-400",
};

export const issueStatusTextDefault = "text-muted-foreground";

// ---------------------------------------------------------------------------
// Badge colors — used by StatusBadge for all entity types
// ---------------------------------------------------------------------------

// Desaturated, premium-minimal palette:
// light mode uses -50 bg + -700 text, dark mode uses -500/10 bg + -300 text
// (tinted-text on subtle wash, no heavy color blocks).
export const statusBadge: Record<string, string> = {
  // Agent statuses
  active: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300",
  running: "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300",
  scheduled_retry: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  paused: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300",
  idle: "bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-300",
  archived: "bg-muted text-muted-foreground",

  // Goal statuses
  planned: "bg-muted text-muted-foreground",
  achieved: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300",
  completed: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300",

  // Run statuses
  failed: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300",
  timed_out: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300",
  succeeded: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300",
  ok: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  error: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300",
  info: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  terminated: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300",
  pending: "bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-300",

  // Approval statuses
  pending_approval: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  revision_requested: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  approved: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300",
  rejected: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300",

  // Issue statuses — consistent hues with issueStatusIcon above
  backlog: "bg-muted text-muted-foreground",
  todo: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  in_progress: "bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-300",
  in_review: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
  blocked: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300",
  done: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300",
  cancelled: "bg-muted text-muted-foreground",
};

export const statusBadgeDefault = "bg-muted text-muted-foreground";

// ---------------------------------------------------------------------------
// Agent status dot — solid background for small indicator dots
// ---------------------------------------------------------------------------

export const agentStatusDot: Record<string, string> = {
  running: "bg-cyan-400 animate-pulse",
  active: "bg-green-400",
  paused: "bg-yellow-400",
  idle: "bg-yellow-400",
  pending_approval: "bg-amber-400",
  error: "bg-red-400",
  archived: "bg-neutral-400",
};

export const agentStatusDotDefault = "bg-neutral-400";

// ---------------------------------------------------------------------------
// Priority colors
// ---------------------------------------------------------------------------

export const priorityColor: Record<string, string> = {
  critical: "text-red-600 dark:text-red-400",
  high: "text-orange-600 dark:text-orange-400",
  medium: "text-yellow-600 dark:text-yellow-400",
  low: "text-blue-600 dark:text-blue-400",
};

export const priorityColorDefault = "text-yellow-600 dark:text-yellow-400";
