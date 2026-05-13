// DEAL DESK: Phase 7 — Targets dashboard page.
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Target as TargetIcon, Plus, ExternalLink } from "lucide-react";
import { useCompany } from "../../context/CompanyContext";
import { useBreadcrumbs } from "../../context/BreadcrumbContext";
import { useToastActions } from "../../context/ToastContext";
import { queryKeys } from "../../lib/queryKeys";
import { useNavigate } from "@/lib/router";
import {
  dealDeskApi,
  type DdTarget,
  type DdTargetStatus,
  type DdSource,
  type Thesis,
} from "../../api/dealDesk";
// DEAL DESK: Phase 7 v0.2 — wire 'Source targets now' to issue creation
import { agentsApi } from "../../api/agents";
import { issuesApi } from "../../api/issues";
import { EmptyState } from "../../components/EmptyState";
import { PageSkeleton } from "../../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TARGET_STATUSES: DdTargetStatus[] = [
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

function fitScoreClasses(score: number | null): string {
  if (score == null) return "bg-muted text-muted-foreground";
  if (score >= 80) return "bg-green-600/20 text-green-600 border-green-600/30";
  if (score >= 60)
    return "bg-yellow-500/20 text-yellow-600 border-yellow-500/30";
  if (score >= 40)
    return "bg-orange-500/20 text-orange-600 border-orange-500/30";
  return "bg-muted text-muted-foreground";
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

export function Targets() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const { pushToast } = useToastActions();
  const navigate = useNavigate();
  const [selectedTarget, setSelectedTarget] = useState<DdTarget | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Deal Sourcing" }, { label: "Targets" }]);
  }, [setBreadcrumbs]);

  const { data: theses, isLoading: thesesLoading } = useQuery({
    queryKey: queryKeys.dealDesk.theses(selectedCompanyId!),
    queryFn: () => dealDeskApi.listTheses(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const [activeThesisId, setActiveThesisId] = useState<string | null>(null);
  const effectiveThesisId = useMemo<string | null>(() => {
    if (activeThesisId) return activeThesisId;
    return theses && theses.length > 0 ? theses[0]!.id : null;
  }, [activeThesisId, theses]);

  const { data: targets, isLoading: targetsLoading } = useQuery({
    queryKey: queryKeys.dealDesk.thesisTargets(
      selectedCompanyId!,
      effectiveThesisId ?? "__none__",
    ),
    queryFn: () =>
      dealDeskApi.listThesisTargets(selectedCompanyId!, effectiveThesisId!),
    enabled: !!selectedCompanyId && !!effectiveThesisId,
  });

  const activeThesis = useMemo<Thesis | null>(() => {
    if (!theses || !effectiveThesisId) return null;
    return theses.find((t) => t.id === effectiveThesisId) ?? null;
  }, [theses, effectiveThesisId]);

  const agentsQuery = useQuery({
    queryKey: ["companies", selectedCompanyId, "agents"],
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
  });

  const sectorSourcerAgent = useMemo(() => {
    return (
      agentsQuery.data?.find(
        (agent) =>
          (agent.role as string) === "dd-sector-sourcer" &&
          agent.status !== "terminated",
      ) ?? null
    );
  }, [agentsQuery.data]);

  const sourceTargetsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCompanyId) throw new Error("No company selected");
      if (!sectorSourcerAgent) throw new Error("No Sector Sourcer hired");
      if (!activeThesis) throw new Error("No active thesis selected");

      const geos = Array.isArray(activeThesis.geos)
        ? (activeThesis.geos as unknown[]).filter(
            (g): g is string => typeof g === "string",
          )
        : [];

      const bodyLines: (string | null)[] = [
        `Sourcing pass for thesis: ${activeThesis.name}`,
        ``,
        `Sector: ${activeThesis.sector}`,
        geos.length ? `Geographies: ${geos.join(", ")}` : null,
        ``,
        `Find 5 well-researched targets matching the criteria. Call`,
        `listTargets first to avoid duplicates. Score honestly.`,
      ];

      return issuesApi.create(selectedCompanyId, {
        title: `Source targets for ${activeThesis.name}`,
        description: bodyLines.filter((l): l is string => l !== null).join("\n"),
        assigneeAgentId: sectorSourcerAgent.id,
        priority: "normal",
      }) as Promise<{ id: string }>;
    },
    onSuccess: (issue) => {
      pushToast({
        title: "Sourcing ticket created",
        body: sectorSourcerAgent
          ? `Assigned to ${sectorSourcerAgent.name}`
          : undefined,
        tone: "success",
      });
      navigate(`/issues/${issue.id}`);
    },
    onError: (err: Error) => {
      if (err.message === "No Sector Sourcer hired") {
        pushToast({
          title: "Hire a Sector Sourcer first",
          tone: "warn",
          action: { label: "Hire one", href: "/deal-desk/hire" },
        });
      } else {
        pushToast({ title: "Could not create sourcing ticket", body: err.message, tone: "error" });
      }
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ targetId, status }: { targetId: string; status: DdTargetStatus }) =>
      dealDeskApi.updateTargetStatus(selectedCompanyId!, targetId, status),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.dealDesk.thesisTargets(
          selectedCompanyId!,
          effectiveThesisId!,
        ),
      });
      setSelectedTarget(updated);
    },
  });

  if (!selectedCompanyId) {
    return (
      <EmptyState icon={TargetIcon} message="Select a fund to view targets." />
    );
  }

  if (thesesLoading) return <PageSkeleton variant="list" />;

  if (!theses || theses.length === 0) {
    return (
      <EmptyState
        icon={TargetIcon}
        message="No investment theses yet. Set one up in the onboarding wizard."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Select
            value={effectiveThesisId ?? undefined}
            onValueChange={(v) => setActiveThesisId(v)}
          >
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Select a thesis" />
            </SelectTrigger>
            <SelectContent>
              {theses.map((t: Thesis) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col items-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => sourceTargetsMutation.mutate()}
            disabled={
              sourceTargetsMutation.isPending ||
              !activeThesis ||
              !sectorSourcerAgent
            }
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {sourceTargetsMutation.isPending
              ? "Creating ticket…"
              : "Source targets now"}
          </Button>
          {!sectorSourcerAgent && !agentsQuery.isLoading && (
            <p className="mt-1 text-xs text-muted-foreground">
              Hire a Sector Sourcer to enable this action.{" "}
              <a className="underline" href="/deal-desk/hire">
                Hire one →
              </a>
            </p>
          )}
        </div>
      </div>

      {targetsLoading ? (
        <PageSkeleton variant="list" />
      ) : !targets || targets.length === 0 ? (
        <EmptyState
          icon={TargetIcon}
          message="No targets yet for this thesis."
        />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium">Sector</th>
                <th className="px-3 py-2 font-medium">State</th>
                <th className="px-3 py-2 font-medium">Fit</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Sourced</th>
              </tr>
            </thead>
            <tbody>
              {targets.map((t) => (
                <tr
                  key={t.id}
                  className="border-t border-border cursor-pointer hover:bg-accent/40"
                  onClick={() => setSelectedTarget(t)}
                >
                  <td className="px-3 py-2 font-medium">{t.companyName}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {t.sector ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {t.hqState ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant="outline"
                      className={fitScoreClasses(t.fitScore)}
                    >
                      {t.fitScore ?? "—"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary">{t.status}</Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {formatDate(t.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet
        open={!!selectedTarget}
        onOpenChange={(open) => {
          if (!open) setSelectedTarget(null);
        }}
      >
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedTarget && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedTarget.companyName}</SheetTitle>
                <SheetDescription>
                  {selectedTarget.sector ?? "—"}
                  {selectedTarget.hqState ? ` · ${selectedTarget.hqState}` : ""}
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-6 space-y-4 text-sm">
                {selectedTarget.website && (
                  <div>
                    <a
                      href={selectedTarget.website}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      {selectedTarget.website}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}

                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    Fit
                  </div>
                  <Badge
                    variant="outline"
                    className={fitScoreClasses(selectedTarget.fitScore)}
                  >
                    {selectedTarget.fitScore ?? "—"}
                  </Badge>
                </div>

                {selectedTarget.description && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      Description
                    </div>
                    <p>{selectedTarget.description}</p>
                  </div>
                )}

                {selectedTarget.fitRationale && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      Fit rationale
                    </div>
                    <p>{selectedTarget.fitRationale}</p>
                  </div>
                )}

                {Array.isArray(selectedTarget.sources) &&
                  (selectedTarget.sources as DdSource[]).length > 0 && (
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                        Sources
                      </div>
                      <ul className="list-disc list-inside space-y-1">
                        {(selectedTarget.sources as DdSource[]).map((s, i) => (
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
                    value={selectedTarget.status}
                    onValueChange={(v) =>
                      updateStatus.mutate({
                        targetId: selectedTarget.id,
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
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedTarget.notes && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      Notes
                    </div>
                    <p className="whitespace-pre-wrap">{selectedTarget.notes}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
