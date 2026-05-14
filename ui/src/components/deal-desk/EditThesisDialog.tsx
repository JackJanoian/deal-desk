// DEAL DESK: Phase 6 v0.2 — modal wrapper around <ThesisForm/>. Writes
// through dealDeskApi.updateThesis and invalidates the thesis caches.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { dealDeskApi, type Thesis } from "@/api/dealDesk";
import { queryKeys } from "@/lib/queryKeys";
import {
  ThesisForm,
  thesisFormValuesToApiPayload,
  type ThesisFormValues,
} from "./ThesisForm";
import type { ThesisAttachment } from "./FolderAttachmentInput";

interface EditThesisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  thesis: Thesis;
}

function thesisToFormValues(thesis: Thesis): ThesisFormValues {
  const geos = Array.isArray(thesis.geos)
    ? (thesis.geos as unknown[]).filter(
        (x): x is string => typeof x === "string",
      )
    : [];
  // ownershipPreferences is not exposed on the current Thesis type but the
  // server persists/returns it; tolerate either shape.
  const op = (thesis as unknown as { ownershipPreferences?: unknown })
    .ownershipPreferences;
  const ownership = Array.isArray(op)
    ? (op as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const rev = thesis as unknown as {
    revenueMin?: string | number | null;
    revenueMax?: string | number | null;
  };
  return {
    name: thesis.name,
    sector: thesis.sector,
    geos: geos.join(", "),
    revenueMin: rev.revenueMin == null ? "" : String(rev.revenueMin),
    revenueMax: rev.revenueMax == null ? "" : String(rev.revenueMax),
    ownershipPreferences: ownership,
    narrative: thesis.narrative ?? "",
    templateSlug: thesis.templateSlug ?? null,
    attachments:
      (thesis as { attachments?: ThesisAttachment[] }).attachments ?? [],
  };
}

export function EditThesisDialog({
  open,
  onOpenChange,
  companyId,
  thesis,
}: EditThesisDialogProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (values: ThesisFormValues) =>
      dealDeskApi.updateThesis(
        companyId,
        thesis.id,
        thesisFormValuesToApiPayload(values),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dealDesk.thesis(companyId, thesis.id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dealDesk.theses(companyId),
      });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit thesis</DialogTitle>
        </DialogHeader>
        <ThesisForm
          initial={thesisToFormValues(thesis)}
          onSubmit={async (values) => {
            await mutation.mutateAsync(values);
          }}
          submitting={mutation.isPending}
          submitLabel="Save changes"
        />
      </DialogContent>
    </Dialog>
  );
}
