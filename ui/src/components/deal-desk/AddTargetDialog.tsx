// DEAL DESK: Dialog for manually adding a target to the pipeline.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  dealDeskApi,
  type CreateTargetInput,
  type Thesis,
} from "../../api/dealDesk";
import { queryKeys } from "../../lib/queryKeys";
import { useToastActions } from "../../context/ToastContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type AddTargetDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  thesis: Thesis;
};

export function AddTargetDialog({
  open,
  onOpenChange,
  companyId,
  thesis,
}: AddTargetDialogProps) {
  const queryClient = useQueryClient();
  const { pushToast } = useToastActions();
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [sector, setSector] = useState(thesis.sector ?? "");
  const [fitScore, setFitScore] = useState("60");
  const [fitRationale, setFitRationale] = useState("");

  const reset = () => {
    setCompanyName("");
    setWebsite("");
    setSector(thesis.sector ?? "");
    setFitScore("60");
    setFitRationale("");
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateTargetInput) => dealDeskApi.createTarget(companyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.dealDesk.thesisTargets(companyId, thesis.id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dealDesk.pipeline(companyId, thesis.id),
      });
      pushToast({ title: "Target added to pipeline", tone: "success" });
      reset();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      pushToast({ title: "Could not add target", body: err.message, tone: "error" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const score = parseInt(fitScore, 10);
    if (Number.isNaN(score) || score < 40) {
      pushToast({ title: "Fit score must be at least 40", tone: "warn" });
      return;
    }
    if (fitRationale.trim().length < 10) {
      pushToast({ title: "Fit rationale must be at least 10 characters", tone: "warn" });
      return;
    }

    const payload: CreateTargetInput = {
      thesisId: thesis.id,
      companyName: companyName.trim(),
      fitScore: score,
      fitRationale: fitRationale.trim(),
      sources: [],
    };
    if (website.trim()) payload.website = website.trim();
    if (sector.trim()) payload.sector = sector.trim();

    createMutation.mutate(payload);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add target</DialogTitle>
            <DialogDescription>
              Add a company to the pipeline for {thesis.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="companyName">Company name</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="website">Website (optional)</Label>
              <Input
                id="website"
                type="url"
                placeholder="https://"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sector">Sector</Label>
              <Input
                id="sector"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fitScore">Fit score (40–100)</Label>
              <Input
                id="fitScore"
                type="number"
                min={40}
                max={100}
                value={fitScore}
                onChange={(e) => setFitScore(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fitRationale">Fit rationale</Label>
              <Textarea
                id="fitRationale"
                value={fitRationale}
                onChange={(e) => setFitRationale(e.target.value)}
                rows={3}
                required
                minLength={10}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Adding…" : "Add target"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
