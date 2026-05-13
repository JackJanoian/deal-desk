// DEAL DESK: Phase 7 — Memos dashboard page.
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { useCompany } from "../../context/CompanyContext";
import { useBreadcrumbs } from "../../context/BreadcrumbContext";
import { queryKeys } from "../../lib/queryKeys";
import { dealDeskApi, type DdMemo } from "../../api/dealDesk";
import { EmptyState } from "../../components/EmptyState";
import { PageSkeleton } from "../../components/PageSkeleton";

function formatWeek(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function Memos() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [selected, setSelected] = useState<DdMemo | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Deal Sourcing" }, { label: "Memos" }]);
  }, [setBreadcrumbs]);

  const { data: memos, isLoading } = useQuery({
    queryKey: queryKeys.dealDesk.memos(selectedCompanyId!),
    queryFn: () => dealDeskApi.listMemos(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  if (!selectedCompanyId) {
    return <EmptyState icon={FileText} message="Select a fund to view memos." />;
  }

  if (isLoading) return <PageSkeleton variant="list" />;

  if (!memos || memos.length === 0) {
    return <EmptyState icon={FileText} message="No memos yet." />;
  }

  const active = selected ?? memos[0]!;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
      <aside className="border border-border rounded-lg overflow-hidden">
        <ul className="divide-y divide-border">
          {memos.map((m) => {
            const isActive = m.id === active.id;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setSelected(m)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-accent/40 ${
                    isActive ? "bg-accent/60" : ""
                  }`}
                >
                  <div className="font-medium">Week of {formatWeek(m.weekStartDate)}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatWeek(m.createdAt)}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <article className="border border-border rounded-lg p-4 bg-card">
        <header className="mb-3">
          <h1 className="text-lg font-semibold">
            Pipeline memo — Week of {formatWeek(active.weekStartDate)}
          </h1>
          <p className="text-xs text-muted-foreground">
            Generated {formatWeek(active.createdAt)}
          </p>
        </header>
        {/* TODO(v0.2): proper markdown renderer (MarkdownBody) — plain pre for v0.1. */}
        <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">
          {active.markdown}
        </pre>
      </article>
    </div>
  );
}
