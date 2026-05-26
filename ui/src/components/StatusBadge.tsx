import { cn } from "../lib/utils";
import { statusBadge, statusBadgeDefault } from "../lib/status-colors";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-[1px] text-[10.5px] font-medium tracking-[0.005em] whitespace-nowrap shrink-0",
        statusBadge[status] ?? statusBadgeDefault
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
