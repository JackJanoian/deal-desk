// DEAL DESK: Shared target detail sheet for Pipeline and Targets pages.
import { ExternalLink } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  dealDeskApi,
  type DdSource,
  type DdTarget,
  type DdTargetStatus,
} from "../../api/dealDesk";
import { queryKeys } from "../../lib/queryKeys";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FitScoreBadge } from "./TargetStatusBadge";
import { TARGET_STATUSES } from "./target-utils";

type TargetDetailSheetProps = {
  target: DdTarget | null;
  companyId: string;
  thesisId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTargetUpdated?: (target: DdTarget) => void;
};

export function TargetDetailSheet({
  target,
  companyId,
  thesisId,
  open,
  onOpenChange,
  onTargetUpdated,
}: TargetDetailSheetProps) {
  const queryClient = useQueryClient();

  const invalidateTargets = () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.dealDesk.thesisTargets(companyId, thesisId),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.dealDesk.pipeline(companyId, thesisId),
    });
  };

  const updateStatus = useMutation({
    mutationFn: ({ targetId, status }: { targetId: string; status: DdTargetStatus }) =>
      dealDeskApi.updateTargetStatus(companyId, targetId, status),
    onSuccess: (updated) => {
      invalidateTargets();
      onTargetUpdated?.(updated);
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {target && (
          <>
            <SheetHeader>
              <SheetTitle>{target.companyName}</SheetTitle>
              <SheetDescription>
                {target.sector ?? "—"}
                {target.hqState ? ` · ${target.hqState}` : ""}
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-6 space-y-4 text-sm">
              {target.website && (
                <div>
                  <a
                    href={target.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {target.website}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  Fit
                </div>
                <FitScoreBadge score={target.fitScore} />
              </div>

              {target.description && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    Description
                  </div>
                  <p>{target.description}</p>
                </div>
              )}

              {target.fitRationale && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    Fit rationale
                  </div>
                  <p>{target.fitRationale}</p>
                </div>
              )}

              {Array.isArray(target.sources) &&
                (target.sources as DdSource[]).length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      Sources
                    </div>
                    <ul className="list-disc list-inside space-y-1">
                      {(target.sources as DdSource[]).map((s, i) => (
                        <li key={i}>
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                          >
                            {s.description || s.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  Status
                </div>
                <Select
                  value={target.status}
                  onValueChange={(v) =>
                    updateStatus.mutate({
                      targetId: target.id,
                      status: v as DdTargetStatus,
                    })
                  }
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TARGET_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {target.notes && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    Notes
                  </div>
                  <p className="whitespace-pre-wrap">{target.notes}</p>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
