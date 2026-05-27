// DEAL DESK: Phase 8 — pre-built PE agent role templates (read-only list).
//
// Surfaces the seeded role templates from /api/companies/:companyId/deal-desk/
// role-templates and routes "Hire" into the existing /agents/new prefill flow.
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Clock, DollarSign, Plus } from "lucide-react";
import { useNavigate } from "@/lib/router";
import { useCompany } from "../../context/CompanyContext";
import { useBreadcrumbs } from "../../context/BreadcrumbContext";
import { queryKeys } from "../../lib/queryKeys";
import { dealDeskApi } from "../../api/dealDesk";
import { EmptyState } from "../../components/EmptyState";
import { PageSkeleton } from "../../components/PageSkeleton";
import { Button } from "@/components/ui/button";

export function HireRoles() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();

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
      <EmptyState icon={Briefcase} message="Select a fund to see DealDesk roles." />
    );
  }

  if (isLoading) return <PageSkeleton variant="list" />;

  if (!templates || templates.length === 0) {
    return <EmptyState icon={Briefcase} message="No role templates seeded yet." />;
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-lg font-semibold">Hire a DealDesk Role</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pre-built PE agent configurations. Each role ships with a focused
          system prompt, recommended cadence, and monthly budget.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* DEAL DESK: v0.3 — create custom employee, no template */}
        <div
          key="custom"
          className="rounded-md border border-dashed border-border bg-card p-4 hover:bg-accent/30 cursor-pointer"
          onClick={() => navigate("/deal-desk/hire/custom")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") navigate("/deal-desk/hire/custom");
          }}
        >
          <div className="flex items-center gap-2 font-semibold">
            <Plus className="h-4 w-4" />
            Create custom employee
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Start from a blank slate — pick a name, attach your own instructions, and hire.
          </p>
        </div>
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
            </dl>

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono">
                {tpl.slug}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  // DEAL DESK: v0.3 — use the simpler DealDesk QuickHire form
                  navigate(`/deal-desk/hire/${encodeURIComponent(tpl.slug)}`)
                }
              >
                Hire
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
