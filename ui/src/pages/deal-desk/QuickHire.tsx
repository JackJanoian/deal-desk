// DEAL DESK: v0.3 — simpler PE-focused hire form
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "@/lib/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../../context/CompanyContext";
import { useBreadcrumbs } from "../../context/BreadcrumbContext";
import { useToastActions } from "../../context/ToastContext";
import { agentsApi } from "../../api/agents";
import { dealDeskApi, type DdRoleTemplate } from "../../api/dealDesk";
import { queryKeys } from "../../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PromptFileInput } from "../../components/deal-desk/PromptFileInput";
import { ReportsToPicker } from "../../components/ReportsToPicker";

export const DEAL_DESK_SKILL_KEYS = [
  "dealdesk",
  "dealdesk-converting-plans-to-tasks",
  "dealdesk-create-agent",
  "dealdesk-create-plugin",
  "dealdesk-dev",
] as const;

type DealDeskQuickHireInput = {
  name: string;
  title: string;
  systemPrompt: string;
  budgetUsd: string;
  reportsTo?: string | null;
};

export type DealDeskQuickHirePayload = {
  name: string;
  title: string;
  role: "general";
  adapterType: "claude_local";
  adapterConfig: {
    dangerouslySkipPermissions: boolean;
  };
  instructionsBundle: {
    entryFile: "AGENTS.md";
    files: {
      "AGENTS.md": string;
    };
  };
  desiredSkills: string[];
  budgetMonthlyCents: number;
  reportsTo?: string;
};

export function buildDealDeskQuickHirePayload(input: DealDeskQuickHireInput): DealDeskQuickHirePayload {
  const budgetCents = Math.max(0, Math.round(Number(input.budgetUsd) * 100));
  const { reportsTo } = input;
  return {
    name: input.name.trim(),
    title: input.title.trim() || input.name.trim(),
    role: "general", // DEAL DESK: PE employees use 'general' role to avoid CEO authz path
    adapterType: "claude_local",
    adapterConfig: {
      dangerouslySkipPermissions: true,
    },
    instructionsBundle: {
      entryFile: "AGENTS.md",
      files: {
        "AGENTS.md": input.systemPrompt,
      },
    },
    desiredSkills: [...DEAL_DESK_SKILL_KEYS],
    budgetMonthlyCents: budgetCents,
    ...(reportsTo ? { reportsTo } : {}),
  };
}

export function QuickHire() {
  const { slug } = useParams<{ slug: string }>();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToastActions();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const isCustom = slug === "custom";

  const templatesQuery = useQuery({
    queryKey: queryKeys.dealDesk.roleTemplates(selectedCompanyId ?? ""),
    queryFn: () => dealDeskApi.listRoleTemplates(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId) && !isCustom,
  });

  const template: DdRoleTemplate | null = useMemo(
    () => (isCustom ? null : templatesQuery.data?.find((t) => t.slug === slug) ?? null),
    [isCustom, templatesQuery.data, slug],
  );

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId ?? ""),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
  });

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [promptFileName, setPromptFileName] = useState<string | null>(null);
  const [budgetUsd, setBudgetUsd] = useState<string>("50");
  const [reportsTo, setReportsTo] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([
      { label: "Hire a Role", href: "/deal-desk/hire" },
      { label: isCustom ? "Custom employee" : template?.name ?? "Hire" },
    ]);
  }, [setBreadcrumbs, isCustom, template]);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setTitle(template.name);
      setSystemPrompt(template.systemPrompt);
      setBudgetUsd(String(template.defaultBudgetUsd));
    }
  }, [template]);

  const createAgent = useMutation({
    mutationFn: async () => {
      if (!selectedCompanyId) throw new Error("No company selected");
      // DEAL DESK: v0.3.1 — the server rejects adapterConfig.promptTemplate for new
      // agents on adapters that support instructions bundles (see
      // server/src/routes/agents.ts assertNoNewAgentLegacyPromptTemplate). Send the
      // prompt via the top-level instructionsBundle instead.
      return agentsApi.create(selectedCompanyId, buildDealDeskQuickHirePayload({
        name,
        title,
        systemPrompt,
        budgetUsd,
        reportsTo,
      }));
    },
    onSuccess: (agent) => {
      pushToast({ title: "Employee hired", body: `${agent.name} is ready`, tone: "success" });
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(selectedCompanyId ?? "") });
      void queryClient.invalidateQueries({ queryKey: queryKeys.org(selectedCompanyId ?? "") });
      navigate("/agents");
    },
    onError: (err: Error) => {
      pushToast({ title: "Could not hire employee", body: err.message, tone: "error" });
    },
  });

  const submitDisabled =
    !name.trim() || !systemPrompt.trim() || createAgent.isPending || !selectedCompanyId;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <header>
        <h1 className="text-xl font-semibold">
          {isCustom ? "Hire a custom employee" : `Hire: ${template?.name ?? "…"}`}
        </h1>
        <p className="text-sm text-muted-foreground">
          Set up an AI analyst in under a minute. Optionally place them in your org chart.
        </p>
      </header>

      <div className="space-y-4">
        <div>
          <Label htmlFor="qh-name">Name *</Label>
          <Input
            id="qh-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Atlanta HVAC Sourcer"
          />
        </div>

        <div>
          <Label htmlFor="qh-title">Title</Label>
          <Input
            id="qh-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Defaults to name"
          />
        </div>

        <div>
          <Label>Instructions *</Label>
          <p className="text-xs text-muted-foreground mb-1">
            Attach a markdown file with the agent's prompt, or paste below.
          </p>
          <PromptFileInput
            value={systemPrompt}
            onChange={(text, fileName) => {
              setSystemPrompt(text);
              setPromptFileName(fileName);
            }}
            fileName={promptFileName}
          />
        </div>

        <div>
          <Label htmlFor="qh-budget">Monthly budget (USD)</Label>
          <Input
            id="qh-budget"
            inputMode="numeric"
            value={budgetUsd}
            onChange={(e) => setBudgetUsd(e.target.value.replace(/[^\d.]/g, ""))}
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground font-normal">Org chart</Label>
          <ReportsToPicker
            agents={agents ?? []}
            value={reportsTo}
            onChange={setReportsTo}
            disabled={!agents?.length}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={() => createAgent.mutate()} disabled={submitDisabled}>
          {createAgent.isPending ? "Hiring…" : "Hire"}
        </Button>
        <Button variant="ghost" onClick={() => navigate("/deal-desk/hire")}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
