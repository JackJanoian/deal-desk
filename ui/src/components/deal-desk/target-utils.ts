// DEAL DESK: Shared target status constants and fit score styling.
import type { DdTargetStatus } from "../../api/dealDesk";

export const TARGET_STATUSES: DdTargetStatus[] = [
  "sourced",
  "qualified",
  "contacted",
  "replied",
  "meeting_booked",
  "in_diligence",
  "passed",
  "closed_won",
  "closed_lost",
];

export const ACTIVE_PIPELINE_STATUSES: DdTargetStatus[] = [
  "sourced",
  "qualified",
  "contacted",
  "replied",
  "meeting_booked",
  "in_diligence",
  "passed",
];

export const CLOSED_PIPELINE_STATUSES: DdTargetStatus[] = [
  "closed_won",
  "closed_lost",
];

export function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function fitScoreClasses(score: number | null): string {
  if (score == null) return "border-border/70 bg-muted/70 text-muted-foreground";
  if (score >= 80) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (score >= 60) return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (score >= 40) return "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300";
  return "border-border/70 bg-muted/70 text-muted-foreground";
}

export function formatTargetDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

export function daysInStage(statusChangedAt: string | null | undefined): number | null {
  if (!statusChangedAt) return null;
  const changed = new Date(statusChangedAt);
  if (Number.isNaN(changed.getTime())) return null;
  return Math.floor((Date.now() - changed.getTime()) / (1000 * 60 * 60 * 24));
}

export function isStaleInStage(
  status: DdTargetStatus,
  statusChangedAt: string | null | undefined,
  thresholdDays = 14,
): boolean {
  if (CLOSED_PIPELINE_STATUSES.includes(status)) return false;
  const days = daysInStage(statusChangedAt);
  return days != null && days > thresholdDays;
}
