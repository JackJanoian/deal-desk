// DEAL DESK: Phase 7 — Intermediaries dashboard page.
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Star } from "lucide-react";
import { useCompany } from "../../context/CompanyContext";
import { useBreadcrumbs } from "../../context/BreadcrumbContext";
import { queryKeys } from "../../lib/queryKeys";
import {
  dealDeskApi,
  type DdIntermediary,
  type CreateIntermediaryInput,
} from "../../api/dealDesk";
import { EmptyState } from "../../components/EmptyState";
import { PageSkeleton } from "../../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function isOverdue(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

function StarRating({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(5, value));
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i < clamped
              ? "fill-yellow-500 text-yellow-500"
              : "text-muted-foreground/40"
          }`}
        />
      ))}
    </span>
  );
}

export function Intermediaries() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<CreateIntermediaryInput>({
    name: "",
    firm: "",
    email: "",
    cadenceDays: 60,
    relationshipStrength: 1,
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Deal Sourcing" }, { label: "Intermediaries" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.dealDesk.intermediaries(selectedCompanyId!),
    queryFn: () => dealDeskApi.listIntermediaries(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const create = useMutation({
    mutationFn: (input: CreateIntermediaryInput) =>
      dealDeskApi.createIntermediary(selectedCompanyId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.dealDesk.intermediaries(selectedCompanyId!),
      });
      setShowAdd(false);
      setForm({
        name: "",
        firm: "",
        email: "",
        cadenceDays: 60,
        relationshipStrength: 1,
      });
    },
  });

  const sorted = useMemo(() => {
    if (!data) return [] as DdIntermediary[];
    return [...data].sort((a, b) => {
      const at = a.nextTouchDue ? new Date(a.nextTouchDue).getTime() : Infinity;
      const bt = b.nextTouchDue ? new Date(b.nextTouchDue).getTime() : Infinity;
      return at - bt;
    });
  }, [data]);

  if (!selectedCompanyId) {
    return (
      <EmptyState icon={Users} message="Select a fund to view intermediaries." />
    );
  }

  if (isLoading) return <PageSkeleton variant="list" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Intermediaries</h1>
        <Button size="sm" variant="outline" onClick={() => setShowAdd((s) => !s)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add intermediary
        </Button>
      </div>

      {showAdd && (
        <div className="border border-border rounded-lg p-4 space-y-3 bg-card">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="dd-im-name">Name</Label>
              <Input
                id="dd-im-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="dd-im-firm">Firm</Label>
              <Input
                id="dd-im-firm"
                value={form.firm ?? ""}
                onChange={(e) => setForm({ ...form, firm: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="dd-im-email">Email</Label>
              <Input
                id="dd-im-email"
                type="email"
                value={form.email ?? ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="dd-im-cadence">Cadence (days)</Label>
              <Input
                id="dd-im-cadence"
                type="number"
                value={form.cadenceDays ?? 60}
                onChange={(e) =>
                  setForm({
                    ...form,
                    cadenceDays: Number(e.target.value) || 60,
                  })
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!form.name || create.isPending}
              onClick={() => create.mutate(form)}
            >
              Save
            </Button>
          </div>
          {create.error && (
            <p className="text-xs text-destructive">
              {(create.error as Error).message}
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{(error as Error).message}</p>
      )}

      {sorted.length === 0 ? (
        <EmptyState
          icon={Users}
          message="No intermediaries yet."
          action="Add intermediary"
          onAction={() => setShowAdd(true)}
        />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Firm</th>
                <th className="px-3 py-2 font-medium">Coverage</th>
                <th className="px-3 py-2 font-medium">Last touch</th>
                <th className="px-3 py-2 font-medium">Next due</th>
                <th className="px-3 py-2 font-medium">Strength</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((i) => {
                const overdue = isOverdue(i.nextTouchDue);
                const sectors = Array.isArray(i.coverageSectors)
                  ? (i.coverageSectors as string[])
                  : [];
                return (
                  <tr
                    key={i.id}
                    className={`border-t border-border ${
                      overdue ? "border-l-4 border-l-destructive" : ""
                    }`}
                  >
                    <td className="px-3 py-2 font-medium">{i.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {i.firm ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {sectors.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          sectors.map((s, idx) => (
                            <Badge key={idx} variant="secondary">
                              {s}
                            </Badge>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatDate(i.lastTouchDate)}
                    </td>
                    <td
                      className={`px-3 py-2 ${
                        overdue ? "text-destructive font-medium" : "text-muted-foreground"
                      }`}
                    >
                      {formatDate(i.nextTouchDue)}
                    </td>
                    <td className="px-3 py-2">
                      <StarRating value={i.relationshipStrength} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
