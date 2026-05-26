// DEAL DESK: Pipeline tracker — kanban view of deal targets by stage.
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { GitBranch, Plus, Table2 } from "lucide-react";
import { Link } from "@/lib/router";
import { useCompany } from "../../context/CompanyContext";
import { useBreadcrumbs } from "../../context/BreadcrumbContext";
import { useToastActions } from "../../context/ToastContext";
import { queryKeys } from "../../lib/queryKeys";
import { useNavigate } from "@/lib/router";
import {
  dealDeskApi,
  type DdTarget,
  type DdTargetStatus,
  type Thesis,
} from "../../api/dealDesk";
import { agentsApi } from "../../api/agents";
import { issuesApi } from "../../api/issues";
import { EmptyState } from "../../components/EmptyState";
import { PageSkeleton } from "../../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { PipelineKanban } from "../../components/deal-desk/PipelineKanban";
import { TargetDetailSheet } from "../../components/deal-desk/TargetDetailSheet";
import { AddTargetDialog } from "../../components/deal-desk/AddTargetDialog";
import {
  ACTIVE_PIPELINE_STATUSES,
  statusLabel,
} from "../../components/deal-desk/target-utils";

export function Pipeline() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const { pushToast } = useToastActions();
  const navigate = useNavigate();
  const [selectedTarget, setSelectedTarget] = useState<DdTarget | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showClosed, setShowClosed] = useState(false);

  useEffect(() => {
    setBreadcrumbs([{ label: "Deal Sourcing" }, { label: "Pipeline" }]);
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

  const { data: summary } = useQuery({
    queryKey: queryKeys.dealDesk.pipeline(selectedCompanyId!, effectiveThesisId ?? "__none__"),
    queryFn: () =>
      dealDeskApi.getPipelineSummary(selectedCompanyId!, effectiveThesisId!),
    enabled: !!selectedCompanyId && !!effectiveThesisId,
  });

  const activeThesis = useMemo<Thesis | null>(() => {
    if (!theses || !effectiveThesisId) return null;
    return theses.find((t) => t.id === effectiveThesisId) ?? null;
  }, [theses, effectiveThesisId]);

  const filteredTargets = useMemo(() => {
    if (!targets) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return targets;
    return targets.filter((t) => t.companyName.toLowerCase().includes(q));
  }, [targets, searchQuery]);

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
        body: sectorSourcerAgent ? `Assigned to ${sectorSourcerAgent.name}` : undefined,
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
      queryClient.invalidateQueries({
        queryKey: queryKeys.dealDesk.pipeline(selectedCompanyId!, effectiveThesisId!),
      });
      if (selectedTarget?.id === updated.id) setSelectedTarget(updated);
    },
  });

  if (!selectedCompanyId) {
    return (
      <EmptyState icon={GitBranch} message="Select a fund to view the pipeline." />
    );
  }

  if (thesesLoading) return <PageSkeleton variant="list" />;

  if (!theses || theses.length === 0) {
    return (
      <EmptyState
        icon={GitBranch}
        message="No investment theses yet. Set one up in the onboarding wizard."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="dd-panel-subtle flex flex-wrap items-center justify-between gap-3 rounded-lg p-3">
        <div className="flex items-center gap-2 flex-wrap">
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
          <Input
            placeholder="Search companies…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-[200px]"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/deal-desk/targets">
              <Table2 className="h-3.5 w-3.5 mr-1.5" />
              View as table
            </Link>
          </Button>
          <Button size="sm" onClick={() => setAddDialogOpen(true)} disabled={!activeThesis}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add target
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => sourceTargetsMutation.mutate()}
            disabled={
              sourceTargetsMutation.isPending || !activeThesis || !sectorSourcerAgent
            }
          >
            {sourceTargetsMutation.isPending ? "Creating ticket…" : "Source targets now"}
          </Button>
        </div>
      </div>

      {summary && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-md border border-primary/25 bg-primary/10 px-2 py-1 font-medium text-primary tabular-nums">
            {summary.total} total
          </span>
          {ACTIVE_PIPELINE_STATUSES.map((status) => (
            <span
              key={status}
              className="rounded-md border border-border/70 bg-card/45 px-2 py-1 text-muted-foreground tabular-nums"
            >
              {statusLabel(status)}: {summary.byStatus[status] ?? 0}
            </span>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-auto py-1 px-2 text-xs"
            onClick={() => setShowClosed((v) => !v)}
          >
            {showClosed ? "Hide closed" : "Show closed"}
          </Button>
        </div>
      )}

      {targetsLoading ? (
        <PageSkeleton variant="list" />
      ) : !filteredTargets || filteredTargets.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          message={
            searchQuery
              ? "No targets match your search."
              : "No targets yet for this thesis."
          }
        />
      ) : (
        <PipelineKanban
          targets={filteredTargets}
          onSelectTarget={setSelectedTarget}
          onUpdateStatus={(targetId, status) =>
            updateStatus.mutate({ targetId, status })
          }
          showClosed={showClosed}
        />
      )}

      {activeThesis && effectiveThesisId && (
        <AddTargetDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          companyId={selectedCompanyId}
          thesis={activeThesis}
        />
      )}

      <TargetDetailSheet
        target={selectedTarget}
        companyId={selectedCompanyId}
        thesisId={effectiveThesisId!}
        open={!!selectedTarget}
        onOpenChange={(open) => {
          if (!open) setSelectedTarget(null);
        }}
        onTargetUpdated={setSelectedTarget}
      />
    </div>
  );
}
