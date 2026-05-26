import { Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  message: string;
  action?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon, message, action, onAction }: EmptyStateProps) {
  return (
    <div className="dd-grid-surface flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card/25 px-6 py-16 text-center">
      <div className="mb-4 rounded-xl border border-border/70 bg-card/70 p-4 shadow-[inset_0_1px_0_color-mix(in_oklab,var(--foreground)_5%,transparent)]">
        <Icon className="h-9 w-9 text-primary/75" />
      </div>
      <p className="mb-4 max-w-md text-sm leading-6 text-muted-foreground">{message}</p>
      {action && onAction && (
        <Button onClick={onAction}>
          <Plus className="h-4 w-4 mr-1.5" />
          {action}
        </Button>
      )}
    </div>
  );
}
