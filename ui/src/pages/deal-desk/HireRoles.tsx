// DEAL DESK: Phase 8 — pre-built PE agent role templates (read-only list).
//
// Surfaces the 5 seeded role templates from /api/companies/:companyId/deal-desk/
// role-templates. Clicking "Hire" currently shows a TODO alert — wiring this
// into the existing /agents/new flow (NewAgent.tsx + AgentConfigForm) is left
// for v0.2 because the agent-config schema (adapter type, model, etc.) needs
// to be reconciled with the template's recommended fields.
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Clock, DollarSign, FileBadge } from "lucide-react";
import { useCompany } from "../../context/CompanyContext";
import { useBreadcrumbs } from "../../context/BreadcrumbContext";
import { queryKeys } from "../../lib/queryKeys";
import { dealDeskApi, type DdRoleTemplate } from "../../api/dealDesk";
import { EmptyState } from "../../components/EmptyState";
import { PageSkeleton } from "../../components/PageSkeleton";
import { Button } from "@/components/ui/button";

function handleHire(template: DdRoleTemplate) {
  // TODO(v0.2): pre-fill /agents/new with this template's name, description,
  // systemPrompt, defaultBudgetUsd, defaultHeartbeatCron, and skillFiles.
  // Until then surface the template content so users can manually copy.
  // eslint-disable-next-line no-alert
  alert(
    `Hire ${template.name} — coming in v0.2.\n\n` +
      `Skills: ${template.skillFiles.join(", ")}\n` +
      `Heartbeat: ${template.defaultHeartbeatCron}\n` +
      `Budget: $${template.defaultBudgetUsd}/mo\n\n` +
      `System prompt:\n${template.systemPrompt}`,
  );
}

export function HireRoles() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([
      { label: "Deal Sourcing" },
      { label: "Hire a Role" },
    ]);
  }, [setBreadcrumbs]);

  const { data: templates, isLoading } = useQuery({
    queryKey: queryKeys.dealDesk.roleTemplates(selectedCompanyId!),
    queryFn: () => dealDeskApi.listRoleTemplates(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  if (!selectedCompanyId) {
    return (
      <EmptyState icon={Briefcase} message="Select a fund to see Deal Desk roles." />
    );
  }

  if (isLoading) return <PageSkeleton variant="list" />;

  if (!templates || templates.length === 0) {
    return <EmptyState icon={Briefcase} message="No role templates seeded yet." />;
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-lg font-semibold">Hire a Deal Desk Role</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pre-built PE agent configurations. Each role ships with a focused
          system prompt, recommended cadence, monthly budget, and skill files.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {templates.map((tpl) => (
          <article
            key={tpl.id}
            className="border border-border rounded-lg p-4 space-y-3 hover:border-foreground/30 transition-colors"
          >
            <div>
              <h2 className="text-sm font-semibold">{tpl.name}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {tpl.description}
              </p>
            </div>

            <dl className="grid grid-cols-1 gap-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                <span className="font-mono">{tpl.defaultHeartbeatCron}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <DollarSign className="h-3 w-3" />
                <span>${tpl.defaultBudgetUsd}/mo recommended</span>
              </div>
              {tpl.skillFiles.length > 0 && (
                <div className="flex items-start gap-1.5">
                  <FileBadge className="h-3 w-3 mt-0.5 shrink-0" />
                  <span className="break-all">{tpl.skillFiles.join(", ")}</span>
                </div>
              )}
            </dl>

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono">
                {tpl.slug}
              </span>
              <Button size="sm" variant="outline" onClick={() => handleHire(tpl)}>
                Hire
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
