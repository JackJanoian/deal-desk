// DEAL DESK: Intermediaries coverage dashboard.
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Handshake } from "lucide-react";
import { Link } from "@/lib/router";
import { useCompany } from "../../context/CompanyContext";
import { useBreadcrumbs } from "../../context/BreadcrumbContext";
import { queryKeys } from "../../lib/queryKeys";
import { dealDeskApi, type DdIntermediary } from "../../api/dealDesk";
import { EmptyState } from "../../components/EmptyState";
import { PageSkeleton } from "../../components/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTargetDate } from "../../components/deal-desk/target-utils";

function isTouchOverdue(nextTouchDue: string | null): boolean {
  if (!nextTouchDue) return false;
  const today = new Date().toISOString().slice(0, 10);
  return nextTouchDue < today;
}
function formatSectors(sectors: unknown): string {
  if (!Array.isArray(sectors)) return "—";
  const labels = sectors.filter((s): s is string => typeof s === "string");
  return labels.length > 0 ? labels.slice(0, 3).join(", ") : "—";
}

export function Intermediaries() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Deal Sourcing" }, { label: "Intermediaries" }]);
  }, [setBreadcrumbs]);

  const { data: intermediaries, isLoading } = useQuery({
    queryKey: queryKeys.dealDesk.intermediaries(selectedCompanyId!),
    queryFn: () => dealDeskApi.listIntermediaries(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  if (!selectedCompanyId) {
    return (
      <EmptyState icon={Handshake} message="Select a fund to view intermediaries." />
    );
  }

  if (isLoading) return <PageSkeleton variant="list" />;

  const rows = intermediaries ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Sell-side bankers, brokers, and advisors tracked by your coverage team.
          Check-in drafts awaiting your review appear on{" "}
          <Link to="/deal-desk/outreach-approvals" className="underline">
            Outreach Approvals
          </Link>
          .
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/deal-desk/outreach-approvals">Review outreach drafts</Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Handshake}
          message="No intermediaries tracked yet. Hire an Intermediary Coverage Analyst to build coverage."
        />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Firm</th>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Sectors</th>
                <th className="px-3 py-2 font-medium">Next touch</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: DdIntermediary) => (
                <tr key={row.id} className="border-t border-border hover:bg-accent/40">
                  <td className="px-3 py-2 font-medium">{row.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.firm ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.title ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.email ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {formatSectors(row.coverageSectors)}
                  </td>
                  <td className="px-3 py-2">
                    {row.nextTouchDue ? (
                      <Badge variant={isTouchOverdue(row.nextTouchDue) ? "destructive" : "secondary"}>
                        {formatTargetDate(row.nextTouchDue)}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
