// DEAL DESK: Phase 7 — Thesis detail page.
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@/lib/router";
import { Target as TargetIcon, Pencil } from "lucide-react";
import { useCompany } from "../../context/CompanyContext";
import { useBreadcrumbs } from "../../context/BreadcrumbContext";
import { queryKeys } from "../../lib/queryKeys";
import { dealDeskApi, type DdTarget } from "../../api/dealDesk";
import { EmptyState } from "../../components/EmptyState";
import { PageSkeleton } from "../../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function fitScoreClasses(score: number | null): string {
  if (score == null) return "bg-muted text-muted-foreground";
  if (score >= 80) return "bg-green-600/20 text-green-600 border-green-600/30";
  if (score >= 60)
    return "bg-yellow-500/20 text-yellow-600 border-yellow-500/30";
  if (score >= 40)
    return "bg-orange-500/20 text-orange-600 border-orange-500/30";
  return "bg-muted text-muted-foreground";
}

function renderList(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ") || "—";
  return "—";
}

export function Thesis() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const params = useParams<{ thesisId?: string }>();
  const thesisId = params.thesisId ?? null;

  const { data: thesis, isLoading: thesisLoading } = useQuery({
    queryKey: queryKeys.dealDesk.thesis(selectedCompanyId!, thesisId ?? "__none__"),
    queryFn: () => dealDeskApi.getThesis(selectedCompanyId!, thesisId!),
    enabled: !!selectedCompanyId && !!thesisId,
  });

  const { data: targets, isLoading: targetsLoading } = useQuery({
    queryKey: queryKeys.dealDesk.thesisTargets(
      selectedCompanyId!,
      thesisId ?? "__none__",
    ),
    queryFn: () =>
      dealDeskApi.listThesisTargets(selectedCompanyId!, thesisId!),
    enabled: !!selectedCompanyId && !!thesisId,
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: "Deal Sourcing" },
      { label: thesis?.name ?? "Thesis" },
    ]);
  }, [setBreadcrumbs, thesis?.name]);

  if (!selectedCompanyId) {
    return <EmptyState icon={TargetIcon} message="Select a fund." />;
  }
  if (thesisLoading) return <PageSkeleton variant="list" />;
  if (!thesis) {
    return <EmptyState icon={TargetIcon} message="Thesis not found." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{thesis.name}</h1>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            // TODO(v0.2): open thesis edit dialog/page.
            window.alert("Thesis editing not yet implemented (v0.2).");
          }}
        >
          <Pencil className="h-3.5 w-3.5 mr-1.5" />
          Edit
        </Button>
      </div>

      <div className="border border-border rounded-lg p-4 bg-card grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
            Sector
          </div>
          <div>{thesis.sector}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
            Sub-sectors
          </div>
          <div>{renderList(thesis.subSectors)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
            Geographies
          </div>
          <div>{renderList(thesis.geos)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
            Status
          </div>
          <div>
            <Badge variant="secondary">{thesis.templateSlug ?? "custom"}</Badge>
          </div>
        </div>
        {thesis.narrative && (
          <div className="md:col-span-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              Narrative
            </div>
            <p className="whitespace-pre-wrap">{thesis.narrative}</p>
          </div>
        )}
      </div>

      <Tabs defaultValue="targets">
        <TabsList>
          <TabsTrigger value="targets">Targets</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="targets" className="pt-4">
          {targetsLoading ? (
            <PageSkeleton variant="list" />
          ) : !targets || targets.length === 0 ? (
            <EmptyState
              icon={TargetIcon}
              message="No targets sourced for this thesis yet."
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
                  </tr>
                </thead>
                <tbody>
                  {targets.map((t: DdTarget) => (
                    <tr key={t.id} className="border-t border-border">
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity" className="pt-4">
          {/* TODO(v0.2): wire to a thesis-scoped activity feed. */}
          <EmptyState
            icon={TargetIcon}
            message="Activity feed coming soon."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
