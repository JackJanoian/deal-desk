import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "../api/dashboard";
import { activityApi } from "../api/activity";
import { accessApi } from "../api/access";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { buildCompanyUserProfileMap } from "../lib/company-members";
import { useCompany } from "../context/CompanyContext";
import { useDialogActions } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { ListSurface } from "../components/ListSurface";
import { PageHeader } from "../components/PageHeader";
import { StatInline } from "../components/StatInline";

import { ActivityRow } from "../components/ActivityRow";
import { IssueRow } from "../components/IssueRow";
import { timeAgo } from "../lib/timeAgo";
import { cn, formatCents } from "../lib/utils";
import {
  AlertTriangle,
  Bot,
  ChevronDown,
  CircleDot,
  DollarSign,
  LayoutDashboard,
  PauseCircle,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { ActiveAgentsPanel } from "../components/ActiveAgentsPanel";
import {
  ChartCard,
  RunActivityChart,
  PriorityChart,
  IssueStatusChart,
  SuccessRateChart,
} from "../components/ActivityCharts";
import { PageSkeleton } from "../components/PageSkeleton";
import type { Agent, Issue } from "@dealdesk/shared";
import { PluginSlotOutlet } from "@/plugins/slots";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { sortIssuesByMostRecentActivity } from "../lib/inbox";

const DASHBOARD_ACTIVITY_LIMIT = 10;
const DASHBOARD_ACTION_QUEUE_LIMIT = 8;

function selectActionQueueIssues(issues: Issue[]): Issue[] {
  // Prioritize unread items, then blocked, then most recent activity.
  return [...issues]
    .sort((a, b) => {
      const aUnread = a.isUnreadForMe ? 1 : 0;
      const bUnread = b.isUnreadForMe ? 1 : 0;
      if (aUnread !== bUnread) return bUnread - aUnread;
      const aBlocked = a.blockerAttention ? 1 : 0;
      const bBlocked = b.blockerAttention ? 1 : 0;
      if (aBlocked !== bBlocked) return bBlocked - aBlocked;
      return sortIssuesByMostRecentActivity(a, b);
    })
    .slice(0, DASHBOARD_ACTION_QUEUE_LIMIT);
}

export function Dashboard() {
  const { selectedCompanyId, companies } = useCompany();
  const { openOnboarding } = useDialogActions();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [animatedActivityIds, setAnimatedActivityIds] = useState<Set<string>>(new Set());
  const seenActivityIdsRef = useRef<Set<string>>(new Set());
  const hydratedActivityRef = useRef(false);
  const activityAnimationTimersRef = useRef<number[]>([]);
  const [analyticsOpen, setAnalyticsOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia?.("(min-width: 1024px)").matches ?? true;
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Dashboard" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.dashboard(selectedCompanyId!),
    queryFn: () => dashboardApi.summary(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: activity } = useQuery({
    queryKey: [...queryKeys.activity(selectedCompanyId!), { limit: DASHBOARD_ACTIVITY_LIMIT }],
    queryFn: () => activityApi.list(selectedCompanyId!, { limit: DASHBOARD_ACTIVITY_LIMIT }),
    enabled: !!selectedCompanyId,
  });

  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: companyMembers } = useQuery({
    queryKey: queryKeys.access.companyUserDirectory(selectedCompanyId!),
    queryFn: () => accessApi.listUserDirectory(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const userProfileMap = useMemo(
    () => buildCompanyUserProfileMap(companyMembers?.users),
    [companyMembers?.users],
  );

  const actionQueueIssues = useMemo(
    () => (issues ? selectActionQueueIssues(issues) : []),
    [issues],
  );
  const recentActivity = useMemo(() => (activity ?? []).slice(0, 10), [activity]);

  useEffect(() => {
    for (const timer of activityAnimationTimersRef.current) {
      window.clearTimeout(timer);
    }
    activityAnimationTimersRef.current = [];
    seenActivityIdsRef.current = new Set();
    hydratedActivityRef.current = false;
    setAnimatedActivityIds(new Set());
  }, [selectedCompanyId]);

  useEffect(() => {
    if (recentActivity.length === 0) return;

    const seen = seenActivityIdsRef.current;
    const currentIds = recentActivity.map((event) => event.id);

    if (!hydratedActivityRef.current) {
      for (const id of currentIds) seen.add(id);
      hydratedActivityRef.current = true;
      return;
    }

    const newIds = currentIds.filter((id) => !seen.has(id));
    if (newIds.length === 0) {
      for (const id of currentIds) seen.add(id);
      return;
    }

    setAnimatedActivityIds((prev) => {
      const next = new Set(prev);
      for (const id of newIds) next.add(id);
      return next;
    });

    for (const id of newIds) seen.add(id);

    const timer = window.setTimeout(() => {
      setAnimatedActivityIds((prev) => {
        const next = new Set(prev);
        for (const id of newIds) next.delete(id);
        return next;
      });
      activityAnimationTimersRef.current = activityAnimationTimersRef.current.filter((t) => t !== timer);
    }, 980);
    activityAnimationTimersRef.current.push(timer);
  }, [recentActivity]);

  useEffect(() => {
    return () => {
      for (const timer of activityAnimationTimersRef.current) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const a of agents ?? []) map.set(a.id, a);
    return map;
  }, [agents]);

  const entityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of issues ?? []) map.set(`issue:${i.id}`, i.identifier ?? i.id.slice(0, 8));
    for (const a of agents ?? []) map.set(`agent:${a.id}`, a.name);
    for (const p of projects ?? []) map.set(`project:${p.id}`, p.name);
    return map;
  }, [issues, agents, projects]);

  const entityTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of issues ?? []) map.set(`issue:${i.id}`, i.title);
    return map;
  }, [issues]);

  if (!selectedCompanyId) {
    if (companies.length === 0) {
      return (
        <EmptyState
          icon={LayoutDashboard}
          message="Welcome to DealDesk. Set up your first company and agent to get started."
          action="Get Started"
          onAction={openOnboarding}
        />
      );
    }
    return (
      <EmptyState icon={LayoutDashboard} message="Create or select a company to view the dashboard." />
    );
  }

  if (isLoading) {
    return <PageSkeleton variant="dashboard" />;
  }

  const hasNoAgents = agents !== undefined && agents.length === 0;
  const totalAgents = data
    ? data.agents.active + data.agents.running + data.agents.paused + data.agents.error
    : 0;
  const totalPendingApprovals = data ? data.pendingApprovals + data.budgets.pendingApprovals : 0;

  const companyName = companies.find((c) => c.id === selectedCompanyId)?.name;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={companyName ? `Overview for ${companyName}` : undefined}
      />

      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {hasNoAgents && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-500/25 dark:bg-amber-950/60">
          <div className="flex items-center gap-2.5">
            <Bot className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm text-amber-900 dark:text-amber-100">
              You have no agents.
            </p>
          </div>
          <button
            onClick={() => openOnboarding({ initialStep: 2, companyId: selectedCompanyId! })}
            className="text-sm font-medium text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100 underline underline-offset-2 shrink-0"
          >
            Create one here
          </button>
        </div>
      )}

      <ActiveAgentsPanel companyId={selectedCompanyId!} />

      {data && (
        <>
          <NeedsAttentionStrip
            agentErrors={data.agents.error}
            blockedTasks={data.tasks.blocked}
            pendingApprovals={totalPendingApprovals}
            budgetIncidents={data.budgets.activeIncidents}
            pausedAgents={data.budgets.pausedAgents}
            pausedProjects={data.budgets.pausedProjects}
            pendingBudgetApprovals={data.budgets.pendingApprovals}
          />

          <ListSurface withoutDividers>
            <div className="grid grid-cols-2 divide-x divide-border/60 lg:grid-cols-4">
              <StatInline
                icon={Bot}
                label="Agents enabled"
                value={totalAgents}
                hint={`${data.agents.running} running · ${data.agents.paused} paused`}
                to="/agents"
              />
              <StatInline
                icon={CircleDot}
                label="Tasks in progress"
                value={data.tasks.inProgress}
                hint={`${data.tasks.open} open · ${data.tasks.blocked} blocked`}
                to="/issues"
              />
              <StatInline
                icon={DollarSign}
                label="Month spend"
                value={formatCents(data.costs.monthSpendCents)}
                hint={
                  data.costs.monthBudgetCents > 0
                    ? `${data.costs.monthUtilizationPercent}% of ${formatCents(data.costs.monthBudgetCents)}`
                    : "Unlimited budget"
                }
                to="/costs"
              />
              <StatInline
                icon={ShieldCheck}
                label="Pending approvals"
                value={totalPendingApprovals}
                hint={
                  data.budgets.pendingApprovals > 0
                    ? `${data.budgets.pendingApprovals} budget overrides`
                    : "Awaiting board review"
                }
                tone={totalPendingApprovals > 0 ? "warning" : "default"}
                to="/approvals"
              />
            </div>
          </ListSurface>

          <div className="grid gap-4 md:grid-cols-2">
            <ActionQueuePanel issues={actionQueueIssues} totalIssues={issues?.length ?? 0} />
            <RecentActivityPanel
              activity={recentActivity}
              animatedIds={animatedActivityIds}
              agentMap={agentMap}
              userProfileMap={userProfileMap}
              entityNameMap={entityNameMap}
              entityTitleMap={entityTitleMap}
            />
          </div>

          <AnalyticsSection
            open={analyticsOpen}
            onOpenChange={setAnalyticsOpen}
            data={data}
            issues={issues ?? []}
            companyId={selectedCompanyId!}
          />
        </>
      )}
    </div>
  );
}

function NeedsAttentionStrip({
  agentErrors,
  blockedTasks,
  pendingApprovals,
  budgetIncidents,
  pausedAgents,
  pausedProjects,
  pendingBudgetApprovals,
}: {
  agentErrors: number;
  blockedTasks: number;
  pendingApprovals: number;
  budgetIncidents: number;
  pausedAgents: number;
  pausedProjects: number;
  pendingBudgetApprovals: number;
}) {
  type Item = {
    key: string;
    icon: typeof Bot;
    label: string;
    detail?: string;
    to: string;
    tone: "danger" | "warning" | "neutral";
  };

  const items: Item[] = [];
  if (budgetIncidents > 0) {
    items.push({
      key: "budgets",
      icon: PauseCircle,
      label: `${budgetIncidents} budget incident${budgetIncidents === 1 ? "" : "s"}`,
      detail: `${pausedAgents} agents · ${pausedProjects} projects paused · ${pendingBudgetApprovals} overrides`,
      to: "/costs",
      tone: "danger",
    });
  }
  if (agentErrors > 0) {
    items.push({
      key: "agent-errors",
      icon: XCircle,
      label: `${agentErrors} agent${agentErrors === 1 ? "" : "s"} in error`,
      to: "/agents",
      tone: "danger",
    });
  }
  if (blockedTasks > 0) {
    items.push({
      key: "blocked",
      icon: AlertTriangle,
      label: `${blockedTasks} blocked task${blockedTasks === 1 ? "" : "s"}`,
      to: "/inbox/mine",
      tone: "warning",
    });
  }
  if (pendingApprovals > 0) {
    items.push({
      key: "approvals",
      icon: ShieldCheck,
      label: `${pendingApprovals} pending approval${pendingApprovals === 1 ? "" : "s"}`,
      to: "/approvals",
      tone: "warning",
    });
  }

  if (items.length === 0) return null;

  const toneClass: Record<Item["tone"], string> = {
    danger: "text-red-600 dark:text-red-300",
    warning: "text-amber-600 dark:text-amber-300",
    neutral: "text-muted-foreground",
  };

  return (
    <ListSurface withoutDividers>
      <div className="divide-y divide-border/60 sm:divide-y-0 sm:divide-x sm:flex">
        {items.slice(0, 3).map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              to={item.to}
              className="flex flex-1 items-center gap-2.5 px-4 py-2.5 text-sm no-underline text-inherit transition-colors hover:bg-accent/30"
            >
              <Icon className={cn("h-4 w-4 shrink-0", toneClass[item.tone])} />
              <span className="min-w-0">
                <span className="block truncate text-foreground">{item.label}</span>
                {item.detail ? (
                  <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
                ) : null}
              </span>
            </Link>
          );
        })}
      </div>
    </ListSurface>
  );
}

function ActionQueuePanel({
  issues,
  totalIssues,
}: {
  issues: Issue[];
  totalIssues: number;
}) {
  return (
    <section className="min-w-0">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Action queue</h3>
        <Link
          to="/inbox/mine"
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Open inbox{totalIssues > issues.length ? ` (${totalIssues})` : ""}
        </Link>
      </div>
      {issues.length === 0 ? (
        <ListSurface withoutDividers>
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Inbox zero. Nothing needs attention right now.
          </div>
        </ListSurface>
      ) : (
        <ListSurface withoutDividers className="bg-card/30">
          <div>
            {issues.map((issue) => (
              <IssueRow
                key={issue.id}
                issue={issue}
                trailingMeta={timeAgo(issue.updatedAt)}
              />
            ))}
          </div>
        </ListSurface>
      )}
    </section>
  );
}

function RecentActivityPanel({
  activity,
  animatedIds,
  agentMap,
  userProfileMap,
  entityNameMap,
  entityTitleMap,
}: {
  activity: Array<Parameters<typeof ActivityRow>[0]["event"]>;
  animatedIds: Set<string>;
  agentMap: Map<string, Agent>;
  userProfileMap: ReturnType<typeof buildCompanyUserProfileMap>;
  entityNameMap: Map<string, string>;
  entityTitleMap: Map<string, string>;
}) {
  const events = activity;
  return (
    <section className="min-w-0">
      <h3 className="mb-2 text-sm font-medium text-muted-foreground">Recent activity</h3>
      {events.length === 0 ? (
        <ListSurface withoutDividers>
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No activity yet.
          </div>
        </ListSurface>
      ) : (
        <ListSurface className="bg-card/30">
          {events.map((event) => (
            <ActivityRow
              key={event.id}
              event={event}
              agentMap={agentMap}
              userProfileMap={userProfileMap}
              entityNameMap={entityNameMap}
              entityTitleMap={entityTitleMap}
              className={animatedIds.has(event.id) ? "activity-row-enter" : undefined}
            />
          ))}
        </ListSurface>
      )}
    </section>
  );
}

function AnalyticsSection({
  open,
  onOpenChange,
  data,
  issues,
  companyId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: NonNullable<ReturnType<typeof dashboardApi.summary> extends Promise<infer T> ? T : never>;
  issues: Issue[];
  companyId: string;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="space-y-3">
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
        <span>Analytics</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 transition-transform",
            open ? "rotate-180" : undefined,
          )}
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <ChartCard title="Run Activity" subtitle="Last 14 days">
            <RunActivityChart activity={data.runActivity} />
          </ChartCard>
          <ChartCard title="Issues by Priority" subtitle="Last 14 days">
            <PriorityChart issues={issues} />
          </ChartCard>
          <ChartCard title="Issues by Status" subtitle="Last 14 days">
            <IssueStatusChart issues={issues} />
          </ChartCard>
          <ChartCard title="Success Rate" subtitle="Last 14 days">
            <SuccessRateChart activity={data.runActivity} />
          </ChartCard>
        </div>

        <PluginSlotOutlet
          slotTypes={["dashboardWidget"]}
          context={{ companyId }}
          className="grid gap-4 md:grid-cols-2"
          itemClassName="dd-panel-subtle rounded-lg p-4"
        />
      </CollapsibleContent>
    </Collapsible>
  );
}
