import { cn } from "./utils";

/**
 * Linear-inspired list row primitives shared across IssueRow, ActionQueue,
 * and inbox row variants. Selection uses an inset left-accent bar plus a
 * subtle background tint; hover stays subdued so dense lists don't flicker.
 */

export const listRowBaseClass =
  "group flex items-center gap-2 px-3 py-2 text-sm no-underline text-inherit transition-[background-color,box-shadow] outline-none";

export const listRowHoverClass = "hover:bg-accent/30";

export const listRowSelectedClass =
  "bg-primary/8 shadow-[inset_2px_0_0_var(--primary)] hover:bg-primary/8";

export function listRowSelectionClass(selected: boolean): string {
  return cn(listRowBaseClass, selected ? listRowSelectedClass : listRowHoverClass);
}
