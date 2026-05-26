// DEAL DESK: Phase 7 — Targets dashboard page.
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Target as TargetIcon, Plus, GitBranch } from "lucide-react";
import { Link } from "@/lib/router";
import { useCompany } from "../../context/CompanyContext";
import { useBreadcrumbs } from "../../context/BreadcrumbContext";
import { useToastActions } from "../../context/ToastContext";
import { queryKeys } from "../../lib/queryKeys";
import { useNavigate } from "@/lib/router";
import {
  dealDeskApi,
  type DdTarget,
  type Thesis,
} from "../../api/dealDesk";
import { agentsApi } from "../../api/agents";
import { issuesApi } from "../../api/issues";
import { EmptyState } from "../../components/EmptyState";
import { PageSkeleton } from "../../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TargetDetailSheet } from "../../components/deal-desk/TargetDetailSheet";
import { FitScoreBadge } from "../../components/deal-desk/TargetStatusBadge";
import { formatTargetDate } from "../../components/deal-desk/target-utils";

export function Targets() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
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
      <div className="dd-panel-subtle flex flex-wrap items-center justify-between gap-3 rounded-lg p-3">
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
          <Button variant="ghost" size="sm" asChild>
            <Link to="/deal-desk/pipeline">
              <GitBranch className="h-3.5 w-3.5 mr-1.5" />
              Pipeline board
            </Link>
          </Button>
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
        <div className="overflow-hidden rounded-lg border border-border/70 bg-card/45">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
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
                  className="cursor-pointer border-t border-border/60 hover:bg-accent/40"
                  onClick={() => setSelectedTarget(t)}
                >
                  <td className="px-3 py-2 font-medium text-foreground/92">{t.companyName}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {t.sector ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {t.hqState ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <FitScoreBadge score={t.fitScore} />
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary">{t.status}</Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {formatTargetDate(t.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {effectiveThesisId && (
        <TargetDetailSheet
          target={selectedTarget}
          companyId={selectedCompanyId}
          thesisId={effectiveThesisId}
          open={!!selectedTarget}
          onOpenChange={(open) => {
            if (!open) setSelectedTarget(null);
          }}
          onTargetUpdated={setSelectedTarget}
        />
      )}
    </div>
  );
}
