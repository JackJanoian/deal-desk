/* DEAL DESK: full visual redesign — dark financial-terminal aesthetic.
   All existing state, props, API calls, and handlers preserved.
   Only visual output and adapter-grid grouping have changed. */
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdapterEnvironmentTestResult } from "@dealdesk/shared";
import { useLocation, useNavigate, useParams } from "@/lib/router";
import { useDialog } from "../context/DialogContext";
import { useCompany } from "../context/CompanyContext";
import { companiesApi } from "../api/companies";
import { dealDeskApi } from "../api/dealDesk";
import { agentsApi } from "../api/agents";
import { approvalsApi } from "../api/approvals";
import { issuesApi } from "../api/issues";
import { projectsApi } from "../api/projects";
import { queryKeys } from "../lib/queryKeys";
import { Dialog, DialogPortal } from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import { cn } from "../lib/utils";
import {
  extractModelName,
  extractProviderIdWithFallback
} from "../lib/model-utils";
import { getUIAdapter } from "../adapters";
import { listUIAdapters } from "../adapters";
import { isVisualAdapterChoice } from "../adapters/metadata";
import { useDisabledAdaptersSync } from "../adapters/use-disabled-adapters";
import { useAdapterCapabilities } from "../adapters/use-adapter-capabilities";
import { getAdapterDisplay } from "../adapters/adapter-display-registry";
import { defaultCreateValues } from "./agent-config-defaults";
import {
  buildOnboardingIssuePayload,
  buildOnboardingProjectPayload,
} from "../lib/onboarding-launch";
import { buildNewAgentRuntimeConfig } from "../lib/new-agent-runtime-config";
import {
  DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX,
  DEFAULT_CODEX_LOCAL_MODEL
} from "@dealdesk/adapter-codex-local";
import { DEFAULT_CURSOR_LOCAL_MODEL } from "@dealdesk/adapter-cursor-local";
import { DEFAULT_GEMINI_LOCAL_MODEL } from "@dealdesk/adapter-gemini-local";
import { DEFAULT_OPENCODE_LOCAL_MODEL, isValidOpenCodeModelId } from "@dealdesk/adapter-opencode-local";
import { resolveRouteOnboardingOptions } from "../lib/onboarding-route";
import {
  Check,
  Loader2,
  ChevronDown,
  X
} from "lucide-react";

type Step = 1 | 2 | 3 | 4 | 5;
type AdapterType = string;

const DEFAULT_TASK_DESCRIPTION = `You are the Managing Partner. You set the direction for sourcing deals.

- hire a Head of Business Development to lead outbound coverage
- write a sourcing plan
- break the pipeline into concrete tasks and start delegating work`;

const STEP_META: Array<{ step: Step; label: string }> = [
  { step: 1, label: "Fund" },
  { step: 2, label: "Thesis" },
  { step: 3, label: "Runtime" },
  { step: 4, label: "Task" },
  { step: 5, label: "Launch" }
];

// DEAL DESK: install hints / website per adapter type (shown when not detected).
const ADAPTER_INSTALL_LINKS: Record<string, string> = {
  claude_local: "https://claude.ai/code",
  codex_local: "https://github.com/openai/codex",
  gemini_local: "https://github.com/google-gemini/gemini-cli",
  cursor: "https://cursor.com",
  opencode_local: "https://github.com/sst/opencode",
  pi_local: "https://docs.anthropic.com"
};

// DEAL DESK: rough categorization for the grouped grid in the runtime step.
const API_KEY_ADAPTERS = new Set<string>([
  "anthropic_api",
  "openai_api",
  "google_api",
  "gemini_api"
]);
const WEBHOOK_ADAPTERS = new Set<string>(["openclaw_gateway", "http"]);

export function OnboardingWizard() {
  const { onboardingOpen, onboardingOptions, closeOnboarding } = useDialog();
  const { companies, setSelectedCompanyId, loading: companiesLoading } = useCompany();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { companyPrefix } = useParams<{ companyPrefix?: string }>();
  const [routeDismissed, setRouteDismissed] = useState(false);

  const disabledTypes = useDisabledAdaptersSync();

  const routeOnboardingOptions =
    companyPrefix && companiesLoading
      ? null
      : resolveRouteOnboardingOptions({
          pathname: location.pathname,
          companyPrefix,
          companies
        });
  const effectiveOnboardingOpen =
    onboardingOpen || (routeOnboardingOptions !== null && !routeDismissed);
  const effectiveOnboardingOptions = onboardingOpen
    ? onboardingOptions
    : routeOnboardingOptions ?? {};

  const initialStep = effectiveOnboardingOptions.initialStep ?? 1;
  const existingCompanyId = effectiveOnboardingOptions.companyId;

  const [step, setStep] = useState<Step>(initialStep);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelOpen, setModelOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");

  // Step 1 — Fund
  const [companyName, setCompanyName] = useState("");

  // Step 2 — Thesis
  const [thesisName, setThesisName] = useState("");
  const [thesisSector, setThesisSector] = useState("");
  const [thesisGeos, setThesisGeos] = useState("");
  const [thesisRevenueMin, setThesisRevenueMin] = useState("");
  const [thesisRevenueMax, setThesisRevenueMax] = useState("");
  const [thesisOwnershipFounder, setThesisOwnershipFounder] = useState(false);
  const [thesisOwnershipFamily, setThesisOwnershipFamily] = useState(false);
  const [thesisOwnershipSponsor, setThesisOwnershipSponsor] = useState(false);
  const [thesisNarrative, setThesisNarrative] = useState("");
  const [thesisTemplateSlug, setThesisTemplateSlug] = useState<string | null>(null);
  const [, setCreatedThesisId] = useState<string | null>(null);

  // Step 3 — Runtime
  const [agentName, setAgentName] = useState("Managing Partner");
  const [adapterType, setAdapterType] = useState<AdapterType>("claude_local");
  const [model, setModel] = useState("");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [url, setUrl] = useState("");
  const [adapterEnvResult, setAdapterEnvResult] =
    useState<AdapterEnvironmentTestResult | null>(null);
  const [adapterEnvError, setAdapterEnvError] = useState<string | null>(null);
  const [adapterEnvLoading, setAdapterEnvLoading] = useState(false);
  const [forceUnsetAnthropicApiKey, setForceUnsetAnthropicApiKey] =
    useState(false);
  const [unsetAnthropicLoading, setUnsetAnthropicLoading] = useState(false);

  // Step 4 — Task
  const [taskTitle, setTaskTitle] = useState(
    "Hire your first Head of BD and create a sourcing plan"
  );
  const [taskDescription, setTaskDescription] = useState(
    DEFAULT_TASK_DESCRIPTION
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoResizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, []);

  const [createdCompanyId, setCreatedCompanyId] = useState<string | null>(
    existingCompanyId ?? null
  );
  const [createdCompanyPrefix, setCreatedCompanyPrefix] = useState<
    string | null
  >(null);
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const [createdIssueRef, setCreatedIssueRef] = useState<string | null>(null);

  useEffect(() => {
    setRouteDismissed(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!effectiveOnboardingOpen) return;
    const cId = effectiveOnboardingOptions.companyId ?? null;
    setStep(effectiveOnboardingOptions.initialStep ?? 1);
    setCreatedCompanyId(cId);
    setCreatedCompanyPrefix(null);
    setCreatedProjectId(null);
    setCreatedAgentId(null);
    setCreatedIssueRef(null);
  }, [
    effectiveOnboardingOpen,
    effectiveOnboardingOptions.companyId,
    effectiveOnboardingOptions.initialStep
  ]);

  useEffect(() => {
    if (!effectiveOnboardingOpen || !createdCompanyId || createdCompanyPrefix) return;
    const company = companies.find((c) => c.id === createdCompanyId);
    if (company) setCreatedCompanyPrefix(company.issuePrefix);
  }, [effectiveOnboardingOpen, createdCompanyId, createdCompanyPrefix, companies]);

  useEffect(() => {
    if (step === 4) autoResizeTextarea();
  }, [step, taskDescription, autoResizeTextarea]);

  const { data: adapterModels } = useQuery({
    queryKey: createdCompanyId
      ? queryKeys.agents.adapterModels(createdCompanyId, adapterType, null)
      : ["agents", "none", "adapter-models", adapterType, null],
    queryFn: () => agentsApi.adapterModels(createdCompanyId!, adapterType, { environmentId: null }),
    enabled: Boolean(createdCompanyId) && effectiveOnboardingOpen && step === 3
  });
  const getCapabilities = useAdapterCapabilities();
  const adapterCaps = getCapabilities(adapterType);
  const isLocalAdapter = adapterCaps.supportsInstructionsBundle || adapterCaps.supportsSkills || adapterCaps.supportsLocalAgentJwt;

  // DEAL DESK: split adapters into three groups for the runtime step grid.
  const { cliAdapters, apiKeyAdapters, customAdapters } = useMemo(() => {
    const SYSTEM_ADAPTER_TYPES = new Set(["process"]);
    const all = listUIAdapters()
      .filter((a) =>
        !SYSTEM_ADAPTER_TYPES.has(a.type) &&
        !disabledTypes.has(a.type) &&
        isVisualAdapterChoice(a.type)
      )
      .map((a) => ({ ...getAdapterDisplay(a.type), type: a.type }));

    return {
      cliAdapters: all.filter(
        (a) => !API_KEY_ADAPTERS.has(a.type) && !WEBHOOK_ADAPTERS.has(a.type)
      ),
      apiKeyAdapters: all.filter((a) => API_KEY_ADAPTERS.has(a.type)),
      customAdapters: all.filter((a) => WEBHOOK_ADAPTERS.has(a.type))
    };
  }, [disabledTypes]);

  const COMMAND_PLACEHOLDERS: Record<string, string> = {
    claude_local: "claude",
    codex_local: "codex",
    gemini_local: "gemini",
    pi_local: "pi",
    cursor: "agent",
    opencode_local: "opencode"
  };
  const effectiveAdapterCommand =
    command.trim() ||
    (COMMAND_PLACEHOLDERS[adapterType] ?? adapterType.replace(/_local$/, ""));

  useEffect(() => {
    if (step !== 3) return;
    setAdapterEnvResult(null);
    setAdapterEnvError(null);
  }, [step, adapterType, model, command, args, url]);

  const selectedModel = (adapterModels ?? []).find((m) => m.id === model);
  const hasAnthropicApiKeyOverrideCheck =
    adapterEnvResult?.checks.some(
      (check) =>
        check.code === "claude_anthropic_api_key_overrides_subscription"
    ) ?? false;
  const shouldSuggestUnsetAnthropicApiKey =
    adapterType === "claude_local" &&
    adapterEnvResult?.status === "fail" &&
    hasAnthropicApiKeyOverrideCheck;
  const filteredModels = useMemo(() => {
    const query = modelSearch.trim().toLowerCase();
    return (adapterModels ?? []).filter((entry) => {
      if (!query) return true;
      const provider = extractProviderIdWithFallback(entry.id, "");
      return (
        entry.id.toLowerCase().includes(query) ||
        entry.label.toLowerCase().includes(query) ||
        provider.toLowerCase().includes(query)
      );
    });
  }, [adapterModels, modelSearch]);
  const groupedModels = useMemo(() => {
    if (adapterType !== "opencode_local") {
      return [
        {
          provider: "models",
          entries: [...filteredModels].sort((a, b) => a.id.localeCompare(b.id))
        }
      ];
    }
    const groups = new Map<string, Array<{ id: string; label: string }>>();
    for (const entry of filteredModels) {
      const provider = extractProviderIdWithFallback(entry.id);
      const bucket = groups.get(provider) ?? [];
      bucket.push(entry);
      groups.set(provider, bucket);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([provider, entries]) => ({
        provider,
        entries: [...entries].sort((a, b) => a.id.localeCompare(b.id))
      }));
  }, [filteredModels, adapterType]);

  function reset() {
    setStep(1);
    setLoading(false);
    setError(null);
    setCompanyName("");
    setAgentName("Managing Partner");
    setAdapterType("claude_local");
    setModel("");
    setCommand("");
    setArgs("");
    setUrl("");
    setAdapterEnvResult(null);
    setAdapterEnvError(null);
    setAdapterEnvLoading(false);
    setForceUnsetAnthropicApiKey(false);
    setUnsetAnthropicLoading(false);
    setTaskTitle("Hire your first Head of BD and create a sourcing plan");
    setTaskDescription(DEFAULT_TASK_DESCRIPTION);
    setCreatedCompanyId(null);
    setCreatedCompanyPrefix(null);
    setCreatedAgentId(null);
    setCreatedProjectId(null);
    setCreatedIssueRef(null);
  }

  function handleClose() {
    reset();
    closeOnboarding();
  }

  function buildAdapterConfig(): Record<string, unknown> {
    const adapter = getUIAdapter(adapterType);
    const config = adapter.buildAdapterConfig({
      ...defaultCreateValues,
      adapterType,
      model:
        adapterType === "codex_local"
          ? model || DEFAULT_CODEX_LOCAL_MODEL
          : adapterType === "gemini_local"
            ? model || DEFAULT_GEMINI_LOCAL_MODEL
          : adapterType === "cursor"
            ? model || DEFAULT_CURSOR_LOCAL_MODEL
            : adapterType === "opencode_local"
              ? model || DEFAULT_OPENCODE_LOCAL_MODEL
              : model,
      command,
      args,
      url,
      dangerouslySkipPermissions:
        adapterType === "claude_local" || adapterType === "opencode_local",
      dangerouslyBypassSandbox:
        adapterType === "codex_local"
          ? DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX
          : defaultCreateValues.dangerouslyBypassSandbox
    });
    if (adapterType === "claude_local" && forceUnsetAnthropicApiKey) {
      const env =
        typeof config.env === "object" &&
        config.env !== null &&
        !Array.isArray(config.env)
          ? { ...(config.env as Record<string, unknown>) }
          : {};
      env.ANTHROPIC_API_KEY = { type: "plain", value: "" };
      config.env = env;
    }
    return config;
  }

  async function runAdapterEnvironmentTest(
    adapterConfigOverride?: Record<string, unknown>
  ): Promise<AdapterEnvironmentTestResult | null> {
    if (!createdCompanyId) {
      setAdapterEnvError(
        "Create or select a company before testing adapter environment."
      );
      return null;
    }
    setAdapterEnvLoading(true);
    setAdapterEnvError(null);
    try {
      const result = await agentsApi.testEnvironment(
        createdCompanyId,
        adapterType,
        {
          adapterConfig: adapterConfigOverride ?? buildAdapterConfig()
        }
      );
      setAdapterEnvResult(result);
      return result;
    } catch (err) {
      setAdapterEnvError(
        err instanceof Error ? err.message : "Adapter environment test failed"
      );
      return null;
    } finally {
      setAdapterEnvLoading(false);
    }
  }

  async function handleStep1Next() {
    setLoading(true);
    setError(null);
    try {
      const company = await companiesApi.create({ name: companyName.trim() });
      setCreatedCompanyId(company.id);
      setCreatedCompanyPrefix(company.issuePrefix);
      setSelectedCompanyId(company.id);
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });

      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create company");
    } finally {
      setLoading(false);
    }
  }

  async function handleThesisNext() {
    if (!createdCompanyId) return;
    if (!thesisSector.trim()) {
      setError("Sector is required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const ownershipPreferences: string[] = [];
      if (thesisOwnershipFounder) ownershipPreferences.push("Founder-owned");
      if (thesisOwnershipFamily) ownershipPreferences.push("Family-owned");
      if (thesisOwnershipSponsor) ownershipPreferences.push("Sponsor-backed");

      const geos = thesisGeos
        .split(",")
        .map((g) => g.trim())
        .filter((g) => g.length > 0);

      const thesis = await dealDeskApi.createThesis(createdCompanyId, {
        name: thesisName.trim() || `${thesisSector.trim()} thesis`,
        sector: thesisSector.trim(),
        geos,
        revenueMin: thesisRevenueMin ? thesisRevenueMin : null,
        revenueMax: thesisRevenueMax ? thesisRevenueMax : null,
        ownershipPreferences,
        narrative: thesisNarrative.trim() || null,
        templateSlug: thesisTemplateSlug
      });
      setCreatedThesisId(thesis.id);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save thesis");
    } finally {
      setLoading(false);
    }
  }

  const thesisTemplates = [
    {
      slug: "hvac-southeast-rollup",
      title: "HVAC Roll-up",
      tag: "Southeast US",
      summary: "Sector: HVAC Services · Revenue: $5–25M",
      apply: () => {
        setThesisName("HVAC Roll-up — Southeast US");
        setThesisSector("HVAC Services");
        setThesisGeos("FL, GA, NC, SC, TN, AL");
        setThesisRevenueMin("5000000");
        setThesisRevenueMax("25000000");
        setThesisTemplateSlug("hvac-southeast-rollup");
      }
    },
    {
      slug: "healthcare-lmm",
      title: "Healthcare Svcs",
      tag: "Lower Mid Market",
      summary: "Sector: Healthcare · Revenue: $5–50M",
      apply: () => {
        setThesisName("Healthcare Services — Lower Middle Market");
        setThesisSector("Healthcare Services");
        setThesisGeos("United States");
        setThesisRevenueMin("5000000");
        setThesisRevenueMax("50000000");
        setThesisTemplateSlug("healthcare-lmm");
      }
    },
    {
      slug: "search-fund-generalist",
      title: "Search Fund",
      tag: "Generalist LMM",
      summary: "Sector: Diversified · Revenue: $3–20M",
      apply: () => {
        setThesisName("Search Fund — Generalist LMM");
        setThesisSector("Diversified");
        setThesisGeos("United States");
        setThesisRevenueMin("3000000");
        setThesisRevenueMax("20000000");
        setThesisTemplateSlug("search-fund-generalist");
      }
    }
  ];

  async function handleStep2Next() {
    if (!createdCompanyId) return;
    setLoading(true);
    setError(null);
    try {
      if (adapterType === "opencode_local") {
        if (!isValidOpenCodeModelId(model)) {
          setError(
            "OpenCode requires an explicit model in provider/model format."
          );
          return;
        }
      }

      if (isLocalAdapter) {
        const result = adapterEnvResult ?? (await runAdapterEnvironmentTest());
        if (!result) return;
      }

      const hire = await agentsApi.hire(createdCompanyId, {
        name: agentName.trim(),
        role: "ceo",
        adapterType,
        adapterConfig: buildAdapterConfig(),
        runtimeConfig: buildNewAgentRuntimeConfig()
      });
      if (hire.approval) {
        await approvalsApi.approve(
          hire.approval.id,
          "Approved during onboarding first-agent setup."
        );
        queryClient.invalidateQueries({
          queryKey: queryKeys.approvals.list(createdCompanyId)
        });
      }
      const agent = hire.agent;
      setCreatedAgentId(agent.id);
      queryClient.invalidateQueries({
        queryKey: queryKeys.agents.list(createdCompanyId)
      });
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setLoading(false);
    }
  }

  async function handleUnsetAnthropicApiKey() {
    if (!createdCompanyId || unsetAnthropicLoading) return;
    setUnsetAnthropicLoading(true);
    setError(null);
    setAdapterEnvError(null);
    setForceUnsetAnthropicApiKey(true);

    const configWithUnset = (() => {
      const config = buildAdapterConfig();
      const env =
        typeof config.env === "object" &&
        config.env !== null &&
        !Array.isArray(config.env)
          ? { ...(config.env as Record<string, unknown>) }
          : {};
      env.ANTHROPIC_API_KEY = { type: "plain", value: "" };
      config.env = env;
      return config;
    })();

    try {
      if (createdAgentId) {
        await agentsApi.update(
          createdAgentId,
          { adapterConfig: configWithUnset },
          createdCompanyId
        );
        queryClient.invalidateQueries({
          queryKey: queryKeys.agents.list(createdCompanyId)
        });
      }

      const result = await runAdapterEnvironmentTest(configWithUnset);
      if (result?.status === "fail") {
        setError(
          "Retried with ANTHROPIC_API_KEY unset in adapter config, but the environment test is still failing."
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to unset ANTHROPIC_API_KEY and retry."
      );
    } finally {
      setUnsetAnthropicLoading(false);
    }
  }

  async function handleStep3Next() {
    if (!createdCompanyId || !createdAgentId) return;
    setError(null);
    setStep(5);
  }

  async function handleLaunch() {
    if (!createdCompanyId || !createdAgentId) return;
    setLoading(true);
    setError(null);
    try {
      let projectId = createdProjectId;
      if (!projectId) {
        const project = await projectsApi.create(
          createdCompanyId,
          buildOnboardingProjectPayload()
        );
        projectId = project.id;
        setCreatedProjectId(projectId);
        queryClient.invalidateQueries({
          queryKey: queryKeys.projects.list(createdCompanyId)
        });
      }

      let issueRef = createdIssueRef;
      if (!issueRef) {
        const issue = await issuesApi.create(
          createdCompanyId,
          buildOnboardingIssuePayload({
            title: taskTitle,
            description: taskDescription,
            assigneeAgentId: createdAgentId,
            projectId,
          })
        );
        issueRef = issue.identifier ?? issue.id;
        setCreatedIssueRef(issueRef);
        queryClient.invalidateQueries({
          queryKey: queryKeys.issues.list(createdCompanyId)
        });
      }

      setSelectedCompanyId(createdCompanyId);
      reset();
      closeOnboarding();
      navigate(
        createdCompanyPrefix
          ? `/${createdCompanyPrefix}/issues/${issueRef}`
          : `/issues/${issueRef}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (step === 1 && companyName.trim()) handleStep1Next();
      else if (step === 2 && thesisSector.trim()) handleThesisNext();
      else if (step === 3 && agentName.trim()) handleStep2Next();
      else if (step === 4 && taskTitle.trim()) handleStep3Next();
      else if (step === 5) handleLaunch();
    }
  }

  if (!effectiveOnboardingOpen) return null;

  const currentStepMeta = STEP_META.find((s) => s.step === step)!;
  const minStep = onboardingOptions.initialStep ?? 1;

  return (
    <Dialog
      open={effectiveOnboardingOpen}
      onOpenChange={(open) => {
        if (!open) {
          setRouteDismissed(true);
          handleClose();
        }
      }}
    >
      <DialogPortal>
        <div className="fixed inset-0 z-50 bg-black" />
        <div
          className="dd-onboarding fixed inset-0 z-50 flex"
          onKeyDown={handleKeyDown}
        >
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-5 right-5 z-10 p-1.5 transition-colors"
            style={{ color: "var(--dd-text-tertiary)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--dd-text-primary)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--dd-text-tertiary)")
            }
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </button>

          {/* Mobile progress bar (<= 900px) */}
          <div
            className="dd-progress-mobile absolute top-0 left-0 right-0 z-[5] items-center px-5 py-4"
            style={{
              background: "var(--dd-bg)",
              borderBottom: "1px solid var(--dd-border)"
            }}
          >
            <div
              style={{
                fontFamily: "var(--dd-font-mono)",
                fontSize: 11,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--dd-text-secondary)"
              }}
            >
              Step {step} of {STEP_META.length} — {currentStepMeta.label}
            </div>
            <div
              className="mt-2 w-full"
              style={{ height: 2, background: "var(--dd-border)" }}
            >
              <div
                style={{
                  height: 2,
                  width: `${(step / STEP_META.length) * 100}%`,
                  background: "var(--dd-accent)",
                  transition: "width 0.3s ease"
                }}
              />
            </div>
          </div>

          {/* Left rail (>= 901px) */}
          <aside
            className="dd-rail dd-step-rail relative shrink-0"
            style={{
              width: "28%",
              maxWidth: 360,
              background: "var(--dd-bg)",
              borderRight: "1px solid var(--dd-border)",
              padding: "80px 0 32px 0",
              display: "flex",
              flexDirection: "column"
            }}
          >
            <div className="flex-1">
              {STEP_META.map((s) => {
                const isCurrent = s.step === step;
                const isComplete = s.step < step;
                return (
                  <button
                    key={s.step}
                    type="button"
                    onClick={() => {
                      if (s.step >= minStep && s.step <= step) setStep(s.step);
                    }}
                    disabled={s.step > step}
                    className="w-full flex items-center text-left"
                    style={{
                      padding: isCurrent ? "12px 0 12px 30px" : "12px 0 12px 32px",
                      borderLeft: isCurrent
                        ? "2px solid var(--dd-accent)"
                        : "2px solid transparent",
                      cursor: s.step <= step ? "pointer" : "default",
                      background: "transparent"
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--dd-font-mono)",
                        fontSize: 11,
                        letterSpacing: "0.08em",
                        width: 24,
                        color: isCurrent
                          ? "var(--dd-accent)"
                          : isComplete
                          ? "var(--dd-success)"
                          : "var(--dd-text-tertiary)"
                      }}
                    >
                      {isComplete
                        ? "✓"
                        : String(s.step).padStart(2, "0")}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--dd-font-body)",
                        fontSize: 13,
                        color: isCurrent
                          ? "var(--dd-accent)"
                          : isComplete
                          ? "var(--dd-text-secondary)"
                          : "var(--dd-text-tertiary)"
                      }}
                    >
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <div style={{ padding: "0 32px" }}>
              <div
                style={{
                  fontFamily: "var(--dd-font-display)",
                  fontSize: 18,
                  color: "var(--dd-text-secondary)",
                  letterSpacing: "-0.02em"
                }}
              >
                Deal Desk
              </div>
              <div
                style={{
                  fontFamily: "var(--dd-font-mono)",
                  fontSize: 9,
                  color: "var(--dd-text-tertiary)",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  marginTop: 2
                }}
              >
                v0.1 · MIT Licensed
              </div>
            </div>
          </aside>

          {/* Right content area */}
          <main
            className="flex-1 overflow-y-auto"
            style={{ background: "var(--dd-surface)" }}
          >
            <div
              key={step}
              className="dd-step-content dd-content-pad"
              style={{
                padding: "64px 72px",
                maxWidth: 760,
                margin: "0 auto"
              }}
            >
              {/* Step header */}
              <StepHeader step={step} />

              <div
                style={{
                  height: 1,
                  background: "var(--dd-border)",
                  margin: "32px 0"
                }}
              />

              {/* Step body */}
              {step === 1 && (
                <div className="space-y-6">
                  <Field label="Fund name">
                    <input
                      className="dd-input"
                      placeholder="Acme Capital Partners"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      autoFocus
                    />
                  </Field>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-8">
                  <div>
                    <div className="dd-label">Start from a template</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {thesisTemplates.map((tpl) => {
                        const selected = thesisTemplateSlug === tpl.slug;
                        return (
                          <button
                            key={tpl.slug}
                            type="button"
                            onClick={tpl.apply}
                            className="text-left transition-colors"
                            style={{
                              background: selected
                                ? "var(--dd-accent-dim)"
                                : "var(--dd-surface-2)",
                              border: selected
                                ? "1px solid var(--dd-accent)"
                                : "1px solid var(--dd-border)",
                              borderRadius: "var(--dd-radius-md)",
                              padding: 14
                            }}
                          >
                            <div
                              style={{
                                fontFamily: "var(--dd-font-body)",
                                fontSize: 14,
                                fontWeight: 500,
                                color: "var(--dd-text-primary)"
                              }}
                            >
                              {tpl.title}
                            </div>
                            <div
                              style={{
                                fontFamily: "var(--dd-font-mono)",
                                fontSize: 10,
                                color: "var(--dd-accent)",
                                letterSpacing: "0.06em",
                                textTransform: "uppercase",
                                marginTop: 4
                              }}
                            >
                              {tpl.tag}
                            </div>
                            <div
                              style={{
                                fontFamily: "var(--dd-font-body)",
                                fontSize: 12,
                                color: "var(--dd-text-secondary)",
                                marginTop: 6
                              }}
                            >
                              {tpl.summary}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <Field label="Thesis name (optional)">
                    <input
                      className="dd-input"
                      placeholder="e.g. HVAC Roll-up — Southeast US"
                      value={thesisName}
                      onChange={(e) => setThesisName(e.target.value)}
                    />
                  </Field>

                  <Field label="Sector">
                    <input
                      className="dd-input"
                      placeholder="HVAC Services, Healthcare, B2B SaaS…"
                      value={thesisSector}
                      onChange={(e) => setThesisSector(e.target.value)}
                    />
                  </Field>

                  <Field label="Geography (comma-separated)">
                    <input
                      className="dd-input"
                      placeholder="FL, GA, NC, SC, TN, AL"
                      value={thesisGeos}
                      onChange={(e) => setThesisGeos(e.target.value)}
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Revenue min (USD)">
                      <input
                        className="dd-input"
                        placeholder="5000000"
                        value={thesisRevenueMin}
                        onChange={(e) => setThesisRevenueMin(e.target.value)}
                        inputMode="numeric"
                      />
                    </Field>
                    <Field label="Revenue max (USD)">
                      <input
                        className="dd-input"
                        placeholder="25000000"
                        value={thesisRevenueMax}
                        onChange={(e) => setThesisRevenueMax(e.target.value)}
                        inputMode="numeric"
                      />
                    </Field>
                  </div>

                  <div>
                    <div className="dd-label">Ownership preferences</div>
                    <div className="flex flex-col gap-2">
                      <DdCheckbox
                        checked={thesisOwnershipFounder}
                        onChange={setThesisOwnershipFounder}
                        label="Founder-owned"
                      />
                      <DdCheckbox
                        checked={thesisOwnershipFamily}
                        onChange={setThesisOwnershipFamily}
                        label="Family-owned"
                      />
                      <DdCheckbox
                        checked={thesisOwnershipSponsor}
                        onChange={setThesisOwnershipSponsor}
                        label="Sponsor-backed"
                      />
                    </div>
                  </div>

                  <Field label="Narrative">
                    <textarea
                      className="dd-input"
                      style={{ minHeight: 100, resize: "vertical" }}
                      placeholder="Describe your investment thesis in your own words"
                      value={thesisNarrative}
                      onChange={(e) => setThesisNarrative(e.target.value)}
                    />
                  </Field>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-8">
                  <Field label="Agent name">
                    <input
                      className="dd-input"
                      placeholder="Managing Partner"
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      autoFocus
                    />
                  </Field>

                  <RuntimeGroup
                    title="CLI Agents"
                    adapters={cliAdapters}
                    adapterType={adapterType}
                    onSelect={(nextType) => {
                      setAdapterType(nextType);
                      if (nextType === "codex_local") {
                        if (!model) setModel(DEFAULT_CODEX_LOCAL_MODEL);
                      } else if (nextType === "gemini_local" && !model) {
                        setModel(DEFAULT_GEMINI_LOCAL_MODEL);
                      } else if (nextType === "cursor" && !model) {
                        setModel(DEFAULT_CURSOR_LOCAL_MODEL);
                      } else if (nextType === "opencode_local") {
                        setModel(DEFAULT_OPENCODE_LOCAL_MODEL);
                      } else {
                        setModel("");
                      }
                    }}
                    showInstallLinks
                  />

                  {apiKeyAdapters.length > 0 && (
                    <RuntimeGroup
                      title="API Keys"
                      adapters={apiKeyAdapters}
                      adapterType={adapterType}
                      onSelect={(nextType) => {
                        setAdapterType(nextType);
                        setModel("");
                      }}
                    />
                  )}

                  {customAdapters.length > 0 && (
                    <RuntimeGroup
                      title="Custom"
                      adapters={customAdapters}
                      adapterType={adapterType}
                      onSelect={(nextType) => {
                        setAdapterType(nextType);
                        setModel("");
                      }}
                    />
                  )}

                  {/* Model selector for local adapters */}
                  {isLocalAdapter && (
                    <div>
                      <div className="dd-label">Model</div>
                      <Popover
                        open={modelOpen}
                        onOpenChange={(next) => {
                          setModelOpen(next);
                          if (!next) setModelSearch("");
                        }}
                      >
                        <PopoverTrigger asChild>
                          <button
                            className="dd-input"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              cursor: "pointer",
                              textAlign: "left"
                            }}
                          >
                            <span
                              style={{
                                color: model
                                  ? "var(--dd-text-primary)"
                                  : "var(--dd-text-tertiary)"
                              }}
                            >
                              {selectedModel
                                ? selectedModel.label
                                : model ||
                                  (adapterType === "opencode_local"
                                    ? "Select model (required)"
                                    : "Default")}
                            </span>
                            <ChevronDown
                              className="h-3 w-3"
                              style={{ color: "var(--dd-text-tertiary)" }}
                            />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[var(--radix-popover-trigger-width)] p-1"
                          align="start"
                          style={{
                            background: "var(--dd-surface-2)",
                            border: "1px solid var(--dd-border)",
                            borderRadius: 0
                          }}
                        >
                          <input
                            className="w-full px-2 py-1.5 text-xs bg-transparent outline-none mb-1"
                            style={{
                              borderBottom: "1px solid var(--dd-border)",
                              color: "var(--dd-text-primary)"
                            }}
                            placeholder="Search models..."
                            value={modelSearch}
                            onChange={(e) => setModelSearch(e.target.value)}
                            autoFocus
                          />
                          {adapterType !== "opencode_local" && (
                            <button
                              className="flex items-center gap-2 w-full px-2 py-1.5 text-sm"
                              style={{
                                background: !model
                                  ? "var(--dd-accent-dim)"
                                  : "transparent",
                                color: "var(--dd-text-primary)"
                              }}
                              onClick={() => {
                                setModel("");
                                setModelOpen(false);
                              }}
                            >
                              Default
                            </button>
                          )}
                          <div className="max-h-[240px] overflow-y-auto">
                            {groupedModels.map((group) => (
                              <div
                                key={group.provider}
                                className="mb-1 last:mb-0"
                              >
                                {adapterType === "opencode_local" && (
                                  <div
                                    className="px-2 py-1"
                                    style={{
                                      fontFamily: "var(--dd-font-mono)",
                                      fontSize: 10,
                                      letterSpacing: "0.08em",
                                      textTransform: "uppercase",
                                      color: "var(--dd-text-tertiary)"
                                    }}
                                  >
                                    {group.provider} ({group.entries.length})
                                  </div>
                                )}
                                {group.entries.map((m) => (
                                  <button
                                    key={m.id}
                                    className="flex items-center w-full px-2 py-1.5 text-sm"
                                    style={{
                                      background:
                                        m.id === model
                                          ? "var(--dd-accent-dim)"
                                          : "transparent",
                                      color: "var(--dd-text-primary)"
                                    }}
                                    onClick={() => {
                                      setModel(m.id);
                                      setModelOpen(false);
                                    }}
                                  >
                                    <span
                                      className="block w-full text-left truncate"
                                      title={m.id}
                                    >
                                      {adapterType === "opencode_local"
                                        ? extractModelName(m.id)
                                        : m.label}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            ))}
                          </div>
                          {filteredModels.length === 0 && (
                            <p
                              className="px-2 py-1.5 text-xs"
                              style={{ color: "var(--dd-text-tertiary)" }}
                            >
                              No models discovered.
                            </p>
                          )}
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  {isLocalAdapter && (
                    <div
                      style={{
                        border: "1px solid var(--dd-border)",
                        background: "var(--dd-surface-2)",
                        padding: 14
                      }}
                      className="space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div
                            style={{
                              fontFamily: "var(--dd-font-mono)",
                              fontSize: 10,
                              letterSpacing: "0.1em",
                              textTransform: "uppercase",
                              color: "var(--dd-text-secondary)"
                            }}
                          >
                            Adapter environment check
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--dd-text-secondary)",
                              marginTop: 4
                            }}
                          >
                            Live probe — asks the adapter CLI to respond with
                            "hello".
                          </div>
                        </div>
                        <button
                          className="dd-btn-ghost"
                          style={{ padding: "6px 14px", fontSize: 10 }}
                          disabled={adapterEnvLoading}
                          onClick={() => void runAdapterEnvironmentTest()}
                        >
                          {adapterEnvLoading ? "Testing…" : "Test now"}
                        </button>
                      </div>

                      {adapterEnvError && (
                        <div
                          style={{
                            border: "1px solid var(--dd-error)",
                            background: "var(--dd-error-dim)",
                            color: "var(--dd-error)",
                            padding: "8px 10px",
                            fontSize: 11
                          }}
                        >
                          {adapterEnvError}
                        </div>
                      )}

                      {adapterEnvResult &&
                      adapterEnvResult.status === "pass" ? (
                        <div
                          className="flex items-center gap-2"
                          style={{
                            border: "1px solid var(--dd-success)",
                            background: "var(--dd-success-dim)",
                            color: "var(--dd-success)",
                            padding: "8px 12px",
                            fontSize: 12
                          }}
                        >
                          <Check className="h-3.5 w-3.5 shrink-0" />
                          <span style={{ fontWeight: 500 }}>Passed</span>
                        </div>
                      ) : adapterEnvResult ? (
                        <AdapterEnvironmentResult result={adapterEnvResult} />
                      ) : null}

                      {shouldSuggestUnsetAnthropicApiKey && (
                        <div
                          style={{
                            border: "1px solid var(--dd-accent-border)",
                            background: "var(--dd-accent-dim)",
                            padding: "8px 10px"
                          }}
                          className="space-y-2"
                        >
                          <p
                            style={{
                              fontSize: 11,
                              color: "var(--dd-text-primary)",
                              lineHeight: 1.5
                            }}
                          >
                            Claude failed while{" "}
                            <span style={{ fontFamily: "var(--dd-font-mono)" }}>
                              ANTHROPIC_API_KEY
                            </span>{" "}
                            is set. You can clear it in this adapter config and
                            retry.
                          </p>
                          <button
                            className="dd-btn-ghost"
                            style={{ padding: "6px 12px", fontSize: 10 }}
                            disabled={
                              adapterEnvLoading || unsetAnthropicLoading
                            }
                            onClick={() => void handleUnsetAnthropicApiKey()}
                          >
                            {unsetAnthropicLoading
                              ? "Retrying…"
                              : "Unset ANTHROPIC_API_KEY"}
                          </button>
                        </div>
                      )}

                      {adapterEnvResult && adapterEnvResult.status === "fail" && (
                        <div
                          style={{
                            border: "1px solid var(--dd-border)",
                            background: "var(--dd-bg)",
                            padding: "8px 10px",
                            fontSize: 11
                          }}
                          className="space-y-1.5"
                        >
                          <div
                            style={{
                              fontFamily: "var(--dd-font-mono)",
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              color: "var(--dd-text-secondary)"
                            }}
                          >
                            Manual debug
                          </div>
                          <p
                            style={{
                              fontFamily: "var(--dd-font-mono)",
                              color: "var(--dd-text-secondary)",
                              wordBreak: "break-all"
                            }}
                          >
                            {adapterType === "cursor"
                              ? `${effectiveAdapterCommand} -p --mode ask --output-format json "Respond with hello."`
                              : adapterType === "codex_local"
                              ? `${effectiveAdapterCommand} exec --json -`
                              : adapterType === "gemini_local"
                              ? `${effectiveAdapterCommand} --output-format json "Respond with hello."`
                              : adapterType === "opencode_local"
                              ? `${effectiveAdapterCommand} run --format json "Respond with hello."`
                              : `${effectiveAdapterCommand} --print - --output-format stream-json --verbose`}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {(adapterType === "http" ||
                    adapterType === "openclaw_gateway") && (
                    <Field
                      label={
                        adapterType === "openclaw_gateway"
                          ? "Gateway URL"
                          : "Webhook URL"
                      }
                    >
                      <input
                        className="dd-input"
                        style={{ fontFamily: "var(--dd-font-mono)" }}
                        placeholder={
                          adapterType === "openclaw_gateway"
                            ? "ws://127.0.0.1:18789"
                            : "https://..."
                        }
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                      />
                    </Field>
                  )}
                </div>
              )}

              {step === 4 && (
                <div className="space-y-6">
                  <Field label="Task title">
                    <input
                      className="dd-input"
                      placeholder="e.g. Research competitor pricing"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      autoFocus
                    />
                  </Field>
                  <Field label="Description (optional)">
                    <textarea
                      ref={textareaRef}
                      className="dd-input"
                      style={{
                        minHeight: 140,
                        maxHeight: 320,
                        resize: "vertical",
                        overflowY: "auto"
                      }}
                      placeholder="Add more detail about what the agent should do..."
                      value={taskDescription}
                      onChange={(e) => setTaskDescription(e.target.value)}
                    />
                  </Field>
                </div>
              )}

              {step === 5 && (
                <SuccessScreen
                  companyName={companyName}
                  agentName={agentName}
                  taskTitle={taskTitle}
                  adapterLabel={getUIAdapter(adapterType).label}
                />
              )}

              {error && (
                <div
                  className="mt-6"
                  style={{
                    border: "1px solid var(--dd-error)",
                    background: "var(--dd-error-dim)",
                    color: "var(--dd-error)",
                    padding: "10px 14px",
                    fontSize: 12
                  }}
                >
                  {error}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between mt-12">
                <div>
                  {step > 1 && step > minStep && (
                    <button
                      className="dd-btn-ghost"
                      onClick={() => setStep((step - 1) as Step)}
                      disabled={loading}
                    >
                      ← Back
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {step === 1 && (
                    <button
                      className="dd-btn-primary"
                      disabled={!companyName.trim() || loading}
                      onClick={handleStep1Next}
                    >
                      {loading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      {loading ? "Creating…" : "Continue →"}
                    </button>
                  )}
                  {step === 2 && (
                    <button
                      className="dd-btn-primary"
                      disabled={!thesisSector.trim() || loading}
                      onClick={handleThesisNext}
                    >
                      {loading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      {loading ? "Saving…" : "Save & Continue →"}
                    </button>
                  )}
                  {step === 3 && (
                    <button
                      className="dd-btn-primary"
                      disabled={
                        !agentName.trim() || loading || adapterEnvLoading
                      }
                      onClick={handleStep2Next}
                    >
                      {loading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      {loading ? "Connecting…" : "Continue →"}
                    </button>
                  )}
                  {step === 4 && (
                    <button
                      className="dd-btn-primary"
                      disabled={!taskTitle.trim() || loading}
                      onClick={handleStep3Next}
                    >
                      {loading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Continue →
                    </button>
                  )}
                  {step === 5 && (
                    <button
                      className="dd-btn-primary"
                      disabled={loading}
                      onClick={handleLaunch}
                    >
                      {loading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      {loading ? "Launching…" : "Open Deal Desk →"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </main>
        </div>
      </DialogPortal>
    </Dialog>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="dd-label">{label}</div>
      {children}
    </div>
  );
}

function DdCheckbox({
  checked,
  onChange,
  label
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 cursor-pointer text-left"
      style={{
        fontSize: 14,
        color: "var(--dd-text-primary)",
        background: "transparent",
        border: "none",
        padding: 0
      }}
    >
      <span
        aria-hidden
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 16,
          height: 16,
          border: checked
            ? "1px solid var(--dd-accent)"
            : "1px solid var(--dd-border)",
          background: checked ? "var(--dd-accent)" : "var(--dd-surface-2)",
          flexShrink: 0
        }}
      >
        {checked && (
          <Check className="h-3 w-3" style={{ color: "#000" }} />
        )}
      </span>
      {label}
    </button>
  );
}

function StepHeader({ step }: { step: Step }) {
  const headings: Record<Step, { title: string; subtitle: string }> = {
    1: {
      title: "Set up your fund",
      subtitle:
        "This is the fund your AI analysts will source deals for."
    },
    2: {
      title: "Define your investment thesis",
      subtitle:
        "Set the mandate your analysts will source against. Start blank or pick a template."
    },
    3: {
      title: "Connect your AI runtime",
      subtitle:
        "Deal Desk works with any agent. Bring your own — or connect one now."
    },
    4: {
      title: "Give your analyst something to do",
      subtitle:
        "Kick off with a starter task — a sourcing plan, a research brief, an analysis."
    },
    5: {
      title: "Your fund is live.",
      subtitle: ""
    }
  };
  const h = headings[step];
  return (
    <div>
      <h1
        style={{
          fontFamily: "var(--dd-font-display)",
          fontSize: 38,
          lineHeight: 1.1,
          color: "var(--dd-text-primary)",
          letterSpacing: "-0.01em"
        }}
      >
        {h.title}
      </h1>
      {h.subtitle && (
        <p
          style={{
            fontFamily: "var(--dd-font-body)",
            fontSize: 15,
            color: "var(--dd-text-secondary)",
            marginTop: 10,
            maxWidth: 560
          }}
        >
          {h.subtitle}
        </p>
      )}
    </div>
  );
}

type AdapterCardData = {
  type: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  comingSoon?: boolean;
  disabledLabel?: string;
};

function RuntimeGroup({
  title,
  adapters,
  adapterType,
  onSelect,
  showInstallLinks
}: {
  title: string;
  adapters: AdapterCardData[];
  adapterType: string;
  onSelect: (type: string) => void;
  showInstallLinks?: boolean;
}) {
  if (adapters.length === 0) return null;
  return (
    <div>
      <div className="dd-label">{title}</div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {adapters.map((opt) => {
          const selected = adapterType === opt.type;
          const link = showInstallLinks ? ADAPTER_INSTALL_LINKS[opt.type] : undefined;
          return (
            <button
              key={opt.type}
              type="button"
              className="dd-runtime-card"
              data-selected={selected}
              data-disabled={!!opt.comingSoon}
              onClick={() => {
                if (opt.comingSoon) return;
                onSelect(opt.type);
              }}
              disabled={!!opt.comingSoon}
            >
              {selected && <span className="dd-selected-dot" />}
              <opt.icon className="h-5 w-5" />
              <div
                style={{
                  fontFamily: "var(--dd-font-body)",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--dd-text-primary)"
                }}
              >
                {opt.label}
              </div>
              <div
                style={{
                  fontFamily: "var(--dd-font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.06em",
                  color: "var(--dd-text-tertiary)",
                  textTransform: "uppercase"
                }}
              >
                {opt.comingSoon
                  ? opt.disabledLabel ?? "Coming soon"
                  : opt.description}
              </div>
              {link && !opt.comingSoon && (
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    fontFamily: "var(--dd-font-mono)",
                    fontSize: 10,
                    color: "var(--dd-text-tertiary)",
                    textDecoration: "underline",
                    marginTop: "auto"
                  }}
                >
                  Install →
                </a>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SuccessScreen({
  companyName,
  agentName,
  taskTitle,
  adapterLabel
}: {
  companyName: string;
  agentName: string;
  taskTitle: string;
  adapterLabel: string;
}) {
  const lines = [
    `✓  Fund created: ${companyName || "—"}`,
    `✓  Thesis defined`,
    `✓  Runtime connected: ${adapterLabel}`,
    `✓  Analyst hired: ${agentName || "—"}`,
    `✓  Starter task: ${taskTitle || "—"}`,
    `Ready.`
  ];
  return (
    <div className="space-y-6">
      <div
        style={{
          background: "var(--dd-surface-2)",
          border: "1px solid var(--dd-border)",
          padding: 24,
          fontFamily: "var(--dd-font-mono)",
          fontSize: 13,
          color: "var(--dd-text-secondary)",
          lineHeight: 1.9
        }}
      >
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              opacity: 0,
              animation: `ddLineIn 0.4s ease forwards`,
              animationDelay: `${i * 150}ms`,
              color:
                line === "Ready."
                  ? "var(--dd-accent)"
                  : "var(--dd-text-secondary)"
            }}
          >
            {line}
          </div>
        ))}
      </div>
      <div
        style={{
          fontFamily: "var(--dd-font-mono)",
          fontSize: 11,
          color: "var(--dd-text-tertiary)",
          letterSpacing: "0.05em"
        }}
      >
        Run <span style={{ color: "var(--dd-text-secondary)" }}>dealdesk start</span> to launch the dashboard at any time.
      </div>
    </div>
  );
}

function AdapterEnvironmentResult({
  result
}: {
  result: AdapterEnvironmentTestResult;
}) {
  const statusLabel =
    result.status === "pass"
      ? "Passed"
      : result.status === "warn"
      ? "Warnings"
      : "Failed";
  const accent =
    result.status === "pass"
      ? "var(--dd-success)"
      : result.status === "warn"
      ? "var(--dd-accent)"
      : "var(--dd-error)";
  const bg =
    result.status === "pass"
      ? "var(--dd-success-dim)"
      : result.status === "warn"
      ? "var(--dd-accent-dim)"
      : "var(--dd-error-dim)";
  return (
    <div
      style={{
        border: `1px solid ${accent}`,
        background: bg,
        color: accent,
        padding: "8px 10px",
        fontSize: 11
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span style={{ fontWeight: 500 }}>{statusLabel}</span>
        <span style={{ opacity: 0.7 }}>
          {new Date(result.testedAt).toLocaleTimeString()}
        </span>
      </div>
      <div className="mt-1.5 space-y-1">
        {result.checks.map((check, idx) => (
          <div key={`${check.code}-${idx}`} className="leading-relaxed">
            <span
              style={{
                fontFamily: "var(--dd-font-mono)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                opacity: 0.8
              }}
            >
              {check.level}
            </span>
            <span style={{ margin: "0 4px", opacity: 0.6 }}>·</span>
            <span>{check.message}</span>
            {check.detail && (
              <span className="block" style={{ opacity: 0.75 }}>
                ({check.detail})
              </span>
            )}
            {check.hint && (
              <span className="block" style={{ opacity: 0.9 }}>
                Hint: {check.hint}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
