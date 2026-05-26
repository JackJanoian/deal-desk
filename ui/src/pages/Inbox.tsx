import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { INBOX_MINE_ISSUE_STATUS_FILTER } from "@dealdesk/shared";
import { approvalsApi } from "../api/approvals";
import { accessApi } from "../api/access";
import { authApi } from "../api/auth";
import { ApiError } from "../api/client";
import { dashboardApi } from "../api/dashboard";
import { executionWorkspacesApi } from "../api/execution-workspaces";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { heartbeatsApi } from "../api/heartbeats";
import { instanceSettingsApi } from "../api/instanceSettings";
import { projectsApi } from "../api/projects";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useGeneralSettings } from "../context/GeneralSettingsContext";
import { useSidebar } from "../context/SidebarContext";
import { queryKeys } from "../lib/queryKeys";
import { useDialogActions } from "../context/DialogContext";
import {
  applyIssueFilters,
  countActiveIssueFilters,
  type IssueFilterState,
} from "../lib/issue-filters";
import { collectLiveIssueIds } from "../lib/liveIssueIds";
import { formatAssigneeUserLabel } from "../lib/assignees";
import { buildCompanyUserLabelMap, buildCompanyUserProfileMap } from "../lib/company-members";
import {
  armIssueDetailInboxQuickArchive,
  createIssueDetailLocationState,
  createIssueDetailPath,
  rememberIssueDetailLocationState,
  withIssueDetailHeaderSeed,
} from "../lib/issueDetailBreadcrumb";
import { prefetchIssueDetail } from "../lib/issueDetailCache";
import {
  hasBlockingShortcutDialog,
  isKeyboardShortcutTextInputTarget,
  resolveInboxUndoArchiveKeyAction,
} from "../lib/keyboardShortcuts";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { issueTrailingColumns } from "../components/IssueColumns";
import { approvalLabel } from "../components/ApprovalPayload";
import { FailedRunInboxRow } from "../components/inbox/FailedRunInboxRow";
import { InboxAlertsBanner } from "../components/inbox/InboxAlertsBanner";
import { InboxToolbar } from "../components/inbox/InboxToolbar";
import { InboxWorkList } from "../components/inbox/InboxWorkList";
import {
  readIssueIdFromRun,
  runFailureMessage,
} from "../components/inbox/inboxFormatters";
import { Inbox as InboxIcon, Search } from "lucide-react";

const INBOX_HEARTBEAT_RUN_LIMIT = 200;
const INBOX_ISSUE_LIST_LIMIT = 500;
import type { Approval, HeartbeatRun, Issue, JoinRequest } from "@dealdesk/shared";
import {
  ACTIONABLE_APPROVAL_STATUSES,
  DEFAULT_INBOX_ISSUE_COLUMNS,
  buildGroupedInboxSections,
  buildInboxIssueGroupCreateDefaults,
  buildInboxKeyboardNavEntries,
  getAvailableInboxIssueColumns,
  getInboxWorkItemKey,
  getApprovalsForTab,
  getArchivedInboxSearchIssues,
  getInboxKeyboardSelectionIndex,
  getInboxWorkItems,
  getInboxSearchSupplementIssues,
  getLatestFailedRunsByAgent,
  matchesInboxIssueSearch,
  getRecentTouchedIssues,
  isInboxEntityDismissed,
  isMineInboxTab,
  loadCollapsedInboxGroupKeys,
  loadInboxFilterPreferences,
  loadInboxIssueColumns,
  loadInboxNesting,
  loadInboxWorkItemGroupBy,
  normalizeInboxIssueColumns,
  resolveInboxNestingEnabled,
  shouldResetInboxWorkspaceGrouping,
  resolveIssueWorkspaceName,
  resolveInboxSelectionIndex,
  saveInboxFilterPreferences,
  saveCollapsedInboxGroupKeys,
  saveInboxIssueColumns,
  saveInboxNesting,
  saveInboxWorkItemGroupBy,
  type InboxWorkspaceGroupingOptions,
  type InboxApprovalFilter,
  type InboxCategoryFilter,
  type InboxFilterPreferences,
  type InboxIssueColumn,
  type InboxKeyboardNavEntry,
  saveLastInboxTab,
  shouldShowCompanyAlerts,
  shouldShowInboxSection,
  type InboxGroupedSection,
  type InboxTab,
  type InboxWorkItem,
  type InboxWorkItemGroupBy,
} from "../lib/inbox";
import { useDismissedInboxAlerts, useInboxDismissals, useReadInboxItems } from "../hooks/useInboxBadge";

export { InboxIssueMetaLeading, InboxIssueTrailingColumns } from "../components/IssueColumns";
export { IssueGroupHeader as InboxGroupHeader } from "../components/IssueGroupHeader";
type SectionKey =
  | "work_items"
  | "alerts";

/** A flat navigation entry for keyboard j/k traversal that includes expanded children. */
type NavEntry = InboxKeyboardNavEntry;
type CreatorOption = {
  id: string;
  label: string;
  kind: "agent" | "user";
  searchText?: string;
};

// Re-exported so existing tests/imports against `./Inbox` keep working.
export { formatJoinRequestInboxLabel } from "../components/inbox/inboxFormatters";
export { FailedRunInboxRow } from "../components/inbox/FailedRunInboxRow";

type NonIssueUnreadState = "visible" | "fading" | "hidden" | null;


export function Inbox() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { openNewIssue } = useDialogActions();
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const { keyboardShortcutsEnabled } = useGeneralSettings();
  const { data: experimentalSettings } = useQuery({
    queryKey: queryKeys.instance.experimentalSettings,
    queryFn: () => instanceSettingsApi.getExperimental(),
    retry: false,
  });
  const experimentalSettingsLoaded = experimentalSettings !== undefined;
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedSearchQuery = searchQuery.trim();
  const [filterPreferences, setFilterPreferences] = useState<InboxFilterPreferences>(
    () => loadInboxFilterPreferences(selectedCompanyId),
  );
  const [groupBy, setGroupBy] = useState<InboxWorkItemGroupBy>(() => loadInboxWorkItemGroupBy());
  const [visibleIssueColumns, setVisibleIssueColumns] = useState<InboxIssueColumn[]>(loadInboxIssueColumns);
  const { dismissed: dismissedAlerts, dismiss: dismissAlert } = useDismissedInboxAlerts();
  const { dismissedAtByKey, dismiss: dismissInboxItem } = useInboxDismissals(selectedCompanyId);
  const { readItems, markRead: markItemRead, markUnread: markItemUnread } = useReadInboxItems();
  const { allCategoryFilter, allApprovalFilter, issueFilters } = filterPreferences;

  const pathSegment = location.pathname.split("/").pop() ?? "mine";
  const tab: InboxTab =
    pathSegment === "mine" || pathSegment === "recent" || pathSegment === "all" || pathSegment === "unread"
      ? pathSegment
      : "mine";
  const canArchiveFromTab = isMineInboxTab(tab);
  const issueLinkState = useMemo(
    () =>
      createIssueDetailLocationState(
        "Inbox",
        `${location.pathname}${location.search}${location.hash}`,
        "inbox",
      ),
    [location.pathname, location.search, location.hash],
  );

  const { data: session } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const { data: labels } = useQuery({
    queryKey: queryKeys.issues.labels(selectedCompanyId!),
    queryFn: () => issuesApi.listLabels(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const isolatedWorkspacesEnabled = experimentalSettings?.enableIsolatedWorkspaces === true;
  const { data: executionWorkspaces = [] } = useQuery({
    queryKey: selectedCompanyId
      ? queryKeys.executionWorkspaces.summaryList(selectedCompanyId)
      : ["execution-workspaces", "__disabled__"],
    queryFn: () => executionWorkspacesApi.listSummaries(selectedCompanyId!),
    enabled: !!selectedCompanyId && isolatedWorkspacesEnabled,
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Inbox" }]);
  }, [setBreadcrumbs]);

  useEffect(() => {
    saveLastInboxTab(tab);
    setSelectedIndex(-1);
    setSearchQuery("");
  }, [tab]);

  const previousSelectedCompanyIdRef = useRef<string | null>(selectedCompanyId);
  useEffect(() => {
    if (previousSelectedCompanyIdRef.current !== selectedCompanyId) {
      previousSelectedCompanyIdRef.current = selectedCompanyId;
      setFilterPreferences(loadInboxFilterPreferences(selectedCompanyId));
      setCollapsedGroupKeys(loadCollapsedInboxGroupKeys(selectedCompanyId));
    }
  }, [selectedCompanyId]);

  const {
    data: approvals,
    isLoading: isApprovalsLoading,
    error: approvalsError,
  } = useQuery({
    queryKey: queryKeys.approvals.list(selectedCompanyId!),
    queryFn: () => approvalsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const {
    data: joinRequests = [],
    isLoading: isJoinRequestsLoading,
  } = useQuery({
    queryKey: queryKeys.access.joinRequests(selectedCompanyId!),
    queryFn: async () => {
      try {
        return await accessApi.listJoinRequests(selectedCompanyId!, "pending_approval");
      } catch (err) {
        if (err instanceof ApiError && (err.status === 403 || err.status === 401)) {
          return [];
        }
        throw err;
      }
    },
    enabled: !!selectedCompanyId,
    retry: false,
  });

  const { data: dashboard, isLoading: isDashboardLoading } = useQuery({
    queryKey: queryKeys.dashboard(selectedCompanyId!),
    queryFn: () => dashboardApi.summary(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: issues, isLoading: isIssuesLoading } = useQuery({
    queryKey: [...queryKeys.issues.list(selectedCompanyId!), "with-routine-executions"],
    queryFn: () =>
      issuesApi.list(selectedCompanyId!, {
        includeRoutineExecutions: true,
        limit: INBOX_ISSUE_LIST_LIMIT,
      }),
    enabled: !!selectedCompanyId,
  });
  const {
    data: mineIssuesRaw = [],
    isLoading: isMineIssuesLoading,
  } = useQuery({
    queryKey: [...queryKeys.issues.listMineByMe(selectedCompanyId!), "with-routine-executions"],
    queryFn: () =>
      issuesApi.list(selectedCompanyId!, {
        touchedByUserId: "me",
        inboxArchivedByUserId: "me",
        status: INBOX_MINE_ISSUE_STATUS_FILTER,
        includeRoutineExecutions: true,
        limit: INBOX_ISSUE_LIST_LIMIT,
      }),
    enabled: !!selectedCompanyId,
  });
  const {
    data: touchedIssuesRaw = [],
    isLoading: isTouchedIssuesLoading,
  } = useQuery({
    queryKey: [...queryKeys.issues.listTouchedByMe(selectedCompanyId!), "with-routine-executions"],
    queryFn: () =>
      issuesApi.list(selectedCompanyId!, {
        touchedByUserId: "me",
        status: INBOX_MINE_ISSUE_STATUS_FILTER,
        includeRoutineExecutions: true,
        limit: INBOX_ISSUE_LIST_LIMIT,
      }),
    enabled: !!selectedCompanyId,
  });

  const { data: heartbeatRuns, isLoading: isRunsLoading } = useQuery({
    queryKey: [...queryKeys.heartbeats(selectedCompanyId!), "limit", INBOX_HEARTBEAT_RUN_LIMIT],
    queryFn: () => heartbeatsApi.list(selectedCompanyId!, undefined, INBOX_HEARTBEAT_RUN_LIMIT),
    enabled: !!selectedCompanyId,
  });

  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId!),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 5000,
  });
  const liveIssueIds = useMemo(() => collectLiveIssueIds(liveRuns), [liveRuns]);
  const { data: companyMembers } = useQuery({
    queryKey: queryKeys.access.companyUserDirectory(selectedCompanyId!),
    queryFn: () => accessApi.listUserDirectory(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const currentUserId = session?.user.id ?? session?.session.userId ?? null;

  const companyUserLabelMap = useMemo(
    () => buildCompanyUserLabelMap(companyMembers?.users),
    [companyMembers?.users],
  );
  const companyUserProfileMap = useMemo(
    () => buildCompanyUserProfileMap(companyMembers?.users),
    [companyMembers?.users],
  );

  const mineIssues = useMemo(() => getRecentTouchedIssues(mineIssuesRaw), [mineIssuesRaw]);
  const touchedIssues = useMemo(() => getRecentTouchedIssues(touchedIssuesRaw), [touchedIssuesRaw]);
  const visibleMineIssues = useMemo(
    () => applyIssueFilters(mineIssues, issueFilters, currentUserId, true, liveIssueIds),
    [mineIssues, issueFilters, currentUserId, liveIssueIds],
  );
  const visibleTouchedIssues = useMemo(
    () => applyIssueFilters(touchedIssues, issueFilters, currentUserId, true, liveIssueIds),
    [touchedIssues, issueFilters, currentUserId, liveIssueIds],
  );
  const unreadTouchedIssues = useMemo(
    () => visibleTouchedIssues.filter((issue) => issue.isUnreadForMe),
    [visibleTouchedIssues],
  );
  const creatorOptions = useMemo<CreatorOption[]>(() => {
    const options = new Map<string, CreatorOption>();
    const sourceIssues = [...mineIssues, ...touchedIssues];

    if (currentUserId) {
      options.set(`user:${currentUserId}`, {
        id: `user:${currentUserId}`,
        label: currentUserId === "local-board" ? "Board" : "Me",
        kind: "user",
        searchText: currentUserId === "local-board" ? "board me human local-board" : `me board human ${currentUserId}`,
      });
    }

    for (const issue of sourceIssues) {
      if (issue.createdByUserId) {
        const id = `user:${issue.createdByUserId}`;
        if (!options.has(id)) {
          options.set(id, {
            id,
            label: formatAssigneeUserLabel(issue.createdByUserId, currentUserId) ?? issue.createdByUserId.slice(0, 5),
            kind: "user",
            searchText: `${issue.createdByUserId} board user human`,
          });
        }
      }
    }

    const knownAgentIds = new Set<string>();
    for (const agent of agents ?? []) {
      knownAgentIds.add(agent.id);
      const id = `agent:${agent.id}`;
      if (!options.has(id)) {
        options.set(id, {
          id,
          label: agent.name,
          kind: "agent",
          searchText: `${agent.name} ${agent.id} agent`,
        });
      }
    }

    for (const issue of sourceIssues) {
      if (issue.createdByAgentId && !knownAgentIds.has(issue.createdByAgentId)) {
        const id = `agent:${issue.createdByAgentId}`;
        if (!options.has(id)) {
          options.set(id, {
            id,
            label: issue.createdByAgentId.slice(0, 8),
            kind: "agent",
            searchText: `${issue.createdByAgentId} agent`,
          });
        }
      }
    }

    return [...options.values()].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "user" ? -1 : 1;
      return a.label.localeCompare(b.label);
    });
  }, [agents, currentUserId, mineIssues, touchedIssues]);
  const issuesToRender = useMemo(
    () => {
      if (tab === "mine") return visibleMineIssues;
      if (tab === "unread") return unreadTouchedIssues;
      return visibleTouchedIssues;
    },
    [tab, visibleMineIssues, visibleTouchedIssues, unreadTouchedIssues],
  );

  const agentById = useMemo(() => {
    const map = new Map<string, string>();
    for (const agent of agents ?? []) map.set(agent.id, agent.name);
    return map;
  }, [agents]);

  const issueById = useMemo(() => {
    const map = new Map<string, Issue>();
    for (const issue of issues ?? []) map.set(issue.id, issue);
    return map;
  }, [issues]);
  const projectById = useMemo(() => {
    const map = new Map<string, { name: string; color: string | null }>();
    for (const project of projects ?? []) {
      map.set(project.id, { name: project.name, color: project.color });
    }
    return map;
  }, [projects]);
  const projectWorkspaceById = useMemo(() => {
    const map = new Map<string, { name: string; projectId: string }>();
    for (const project of projects ?? []) {
      for (const workspace of project.workspaces ?? []) {
        map.set(workspace.id, { name: workspace.name, projectId: project.id });
      }
    }
    return map;
  }, [projects]);
  const defaultProjectWorkspaceIdByProjectId = useMemo(() => {
    const map = new Map<string, string>();
    for (const project of projects ?? []) {
      const defaultWorkspaceId =
        project.executionWorkspacePolicy?.defaultProjectWorkspaceId
        ?? project.primaryWorkspace?.id
        ?? null;
      if (defaultWorkspaceId) map.set(project.id, defaultWorkspaceId);
    }
    return map;
  }, [projects]);
  const executionWorkspaceById = useMemo(() => {
    const map = new Map<string, {
      name: string;
      mode: "shared_workspace" | "isolated_workspace" | "operator_branch" | "adapter_managed" | "cloud_sandbox";
      projectWorkspaceId: string | null;
      projectId: string | null;
    }>();
    for (const workspace of executionWorkspaces) {
      const projectWorkspace = workspace.projectWorkspaceId
        ? projectWorkspaceById.get(workspace.projectWorkspaceId) ?? null
        : null;
      map.set(workspace.id, {
        name: workspace.name,
        mode: workspace.mode,
        projectWorkspaceId: workspace.projectWorkspaceId ?? null,
        projectId: projectWorkspace?.projectId ?? null,
      });
    }
    return map;
  }, [executionWorkspaces, projectWorkspaceById]);
  const inboxWorkspaceGrouping = useMemo<InboxWorkspaceGroupingOptions>(
    () => ({
      agentById,
      executionWorkspaceById,
      projectWorkspaceById,
      defaultProjectWorkspaceIdByProjectId,
      projectById,
      userLabelById: companyUserLabelMap,
      currentUserId,
    }),
    [
      agentById,
      companyUserLabelMap,
      currentUserId,
      defaultProjectWorkspaceIdByProjectId,
      executionWorkspaceById,
      projectById,
      projectWorkspaceById,
    ],
  );
  const visibleIssueColumnSet = useMemo(() => new Set(visibleIssueColumns), [visibleIssueColumns]);
  const availableIssueColumns = useMemo(
    () => getAvailableInboxIssueColumns(isolatedWorkspacesEnabled),
    [isolatedWorkspacesEnabled],
  );
  const availableIssueColumnSet = useMemo(() => new Set(availableIssueColumns), [availableIssueColumns]);
  const visibleTrailingIssueColumns = useMemo(
    () => issueTrailingColumns.filter((column) => visibleIssueColumnSet.has(column) && availableIssueColumnSet.has(column)),
    [availableIssueColumnSet, visibleIssueColumnSet],
  );

  const failedRuns = useMemo(
    () =>
      getLatestFailedRunsByAgent(heartbeatRuns ?? []).filter(
        (r) => !isInboxEntityDismissed(dismissedAtByKey, `run:${r.id}`, r.createdAt),
      ),
    [heartbeatRuns, dismissedAtByKey],
  );
  const approvalsToRender = useMemo(() => {
    let filtered = getApprovalsForTab(approvals ?? [], tab, allApprovalFilter, currentUserId);
    if (tab === "mine") {
      filtered = filtered.filter(
        (a) => !isInboxEntityDismissed(dismissedAtByKey, `approval:${a.id}`, a.updatedAt),
      );
    }
    return filtered;
  }, [approvals, tab, allApprovalFilter, currentUserId, dismissedAtByKey]);
  const showJoinRequestsCategory =
    allCategoryFilter === "everything" || allCategoryFilter === "join_requests";
  const showTouchedCategory =
    allCategoryFilter === "everything" || allCategoryFilter === "issues_i_touched";
  const showApprovalsCategory =
    allCategoryFilter === "everything" || allCategoryFilter === "approvals";
  const showFailedRunsCategory =
    allCategoryFilter === "everything" || allCategoryFilter === "failed_runs";
  const showAlertsCategory = allCategoryFilter === "everything" || allCategoryFilter === "alerts";
  const failedRunsForTab = useMemo(() => {
    if (tab === "all" && !showFailedRunsCategory) return [];
    return failedRuns;
  }, [failedRuns, tab, showFailedRunsCategory]);

  const joinRequestsForTab = useMemo(() => {
    if (tab === "all" && !showJoinRequestsCategory) return [];
    if (tab === "mine") {
      return joinRequests.filter(
        (jr) => !isInboxEntityDismissed(dismissedAtByKey, `join:${jr.id}`, jr.updatedAt ?? jr.createdAt),
      );
    }
    return joinRequests;
  }, [joinRequests, tab, showJoinRequestsCategory, dismissedAtByKey]);

  const workItemsToRender = useMemo(
    () =>
      getInboxWorkItems({
        issues: tab === "all" && !showTouchedCategory ? [] : issuesToRender,
        approvals: tab === "all" && !showApprovalsCategory ? [] : approvalsToRender,
        failedRuns: failedRunsForTab,
        joinRequests: joinRequestsForTab,
      }),
    [approvalsToRender, issuesToRender, showApprovalsCategory, showTouchedCategory, tab, failedRunsForTab, joinRequestsForTab],
  );

  const filteredWorkItems = useMemo(() => {
    const q = normalizedSearchQuery.toLowerCase();
    if (!q) return workItemsToRender;
    return workItemsToRender.filter((item) => {
      if (item.kind === "issue") {
        return matchesInboxIssueSearch(item.issue, q, {
          isolatedWorkspacesEnabled,
          executionWorkspaceById,
          projectWorkspaceById,
          defaultProjectWorkspaceIdByProjectId,
        });
      }
      if (item.kind === "approval") {
        const a = item.approval;
        const label = approvalLabel(a.type, a.payload as Record<string, unknown> | null);
        if (label.toLowerCase().includes(q)) return true;
        if (a.type.toLowerCase().includes(q)) return true;
        return false;
      }
      if (item.kind === "failed_run") {
        const run = item.run;
        const name = agentById.get(run.agentId);
        if (name?.toLowerCase().includes(q)) return true;
        const msg = runFailureMessage(run);
        if (msg.toLowerCase().includes(q)) return true;
        const issueId = readIssueIdFromRun(run);
        if (issueId) {
          const issue = issueById.get(issueId);
          if (issue?.title.toLowerCase().includes(q)) return true;
          if (issue?.identifier?.toLowerCase().includes(q)) return true;
        }
        return false;
      }
      if (item.kind === "join_request") {
        const jr = item.joinRequest;
        if (jr.agentName?.toLowerCase().includes(q)) return true;
        if (jr.capabilities?.toLowerCase().includes(q)) return true;
        return false;
      }
      return false;
    });
  }, [
    workItemsToRender,
    agentById,
    defaultProjectWorkspaceIdByProjectId,
    executionWorkspaceById,
    issueById,
    isolatedWorkspacesEnabled,
    normalizedSearchQuery,
    projectWorkspaceById,
  ]);

  const archivedSearchIssues = useMemo(
    () =>
      tab === "mine"
        ? getArchivedInboxSearchIssues({
          visibleIssues: visibleMineIssues,
          searchableIssues: visibleTouchedIssues,
          query: normalizedSearchQuery,
          isolatedWorkspacesEnabled,
          executionWorkspaceById,
          projectWorkspaceById,
          defaultProjectWorkspaceIdByProjectId,
        })
        : [],
    [
      defaultProjectWorkspaceIdByProjectId,
      executionWorkspaceById,
      isolatedWorkspacesEnabled,
      normalizedSearchQuery,
      projectWorkspaceById,
      tab,
      visibleMineIssues,
      visibleTouchedIssues,
    ],
  );
  const shouldUseIssueSearchSupplement =
    !!selectedCompanyId
    && normalizedSearchQuery.length > 0;
  const { data: remoteIssueSearchResults = [] } = useQuery({
    queryKey: [
      ...queryKeys.issues.search(selectedCompanyId!, normalizedSearchQuery, undefined, 25),
      "inbox-supplement",
    ],
    queryFn: () =>
      issuesApi.list(selectedCompanyId!, {
        q: normalizedSearchQuery,
        limit: 25,
        includeRoutineExecutions: true,
      }),
    enabled: shouldUseIssueSearchSupplement,
    placeholderData: (previousData) => previousData,
  });
  const issueSearchSupplementResults = useMemo(
    () =>
      getInboxSearchSupplementIssues({
        query: normalizedSearchQuery,
        filteredWorkItems,
        archivedSearchIssues,
        remoteIssues: remoteIssueSearchResults,
        issueFilters,
        currentUserId,
        enableRoutineVisibilityFilter: true,
        liveIssueIds,
      }),
    [
      archivedSearchIssues,
      currentUserId,
      filteredWorkItems,
      issueFilters,
      liveIssueIds,
      normalizedSearchQuery,
      remoteIssueSearchResults,
    ],
  );
  const nonInboxSearchIssueIds = useMemo(
    () => new Set([
      ...archivedSearchIssues.map((issue) => issue.id),
      ...issueSearchSupplementResults.map((issue) => issue.id),
    ]),
    [archivedSearchIssues, issueSearchSupplementResults],
  );

  // --- Parent-child nesting for inbox issues ---
  const [nestingPreferenceEnabled, setNestingPreferenceEnabled] = useState(() => loadInboxNesting());
  const nestingEnabled = resolveInboxNestingEnabled(nestingPreferenceEnabled, isMobile);
  useEffect(() => {
    if (!shouldResetInboxWorkspaceGrouping(groupBy, isolatedWorkspacesEnabled, experimentalSettingsLoaded)) return;
    setGroupBy("none");
    saveInboxWorkItemGroupBy("none");
  }, [experimentalSettingsLoaded, groupBy, isolatedWorkspacesEnabled]);
  const toggleNesting = useCallback(() => {
    setNestingPreferenceEnabled((prev) => {
      const next = !prev;
      saveInboxNesting(next);
      return next;
    });
  }, []);
  const [collapsedInboxParents, setCollapsedInboxParents] = useState<Set<string>>(new Set());
  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState<Set<string>>(() => loadCollapsedInboxGroupKeys(selectedCompanyId));
  const toggleGroupCollapse = useCallback((groupKey: string) => {
    setCollapsedGroupKeys((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      saveCollapsedInboxGroupKeys(selectedCompanyId, next);
      return next;
    });
  }, [selectedCompanyId]);
  const setGroupCollapsed = useCallback((groupKey: string, collapsed: boolean) => {
    setCollapsedGroupKeys((prev) => {
      if (collapsed ? prev.has(groupKey) : !prev.has(groupKey)) return prev;
      const next = new Set(prev);
      if (collapsed) next.add(groupKey);
      else next.delete(groupKey);
      saveCollapsedInboxGroupKeys(selectedCompanyId, next);
      return next;
    });
  }, [selectedCompanyId]);
  const groupedSections = useMemo<InboxGroupedSection[]>(() => [
    ...buildGroupedInboxSections(filteredWorkItems, groupBy, inboxWorkspaceGrouping, { nestingEnabled }),
    ...buildGroupedInboxSections(
      getInboxWorkItems({ issues: archivedSearchIssues, approvals: [] }),
      groupBy,
      inboxWorkspaceGrouping,
      { keyPrefix: "archived-search:", searchSection: "archived", nestingEnabled },
    ),
    ...buildGroupedInboxSections(
      getInboxWorkItems({ issues: issueSearchSupplementResults, approvals: [] }),
      groupBy,
      inboxWorkspaceGrouping,
      { keyPrefix: "other-search:", searchSection: "other", nestingEnabled },
    ),
  ], [
    archivedSearchIssues,
    filteredWorkItems,
    groupBy,
    inboxWorkspaceGrouping,
    issueSearchSupplementResults,
    nestingEnabled,
  ]);

  const openCreateIssueForGroup = useCallback((group: InboxGroupedSection) => {
    const defaults = buildInboxIssueGroupCreateDefaults(
      group.key,
      groupBy,
      group.displayItems,
      inboxWorkspaceGrouping,
    );
    if (!defaults) return;
    openNewIssue(defaults);
  }, [groupBy, inboxWorkspaceGrouping, openNewIssue]);
  const totalVisibleWorkItems = useMemo(
    () => groupedSections.reduce((count, group) => count + group.displayItems.length, 0),
    [groupedSections],
  );
  const toggleInboxParentCollapse = useCallback((parentId: string) => {
    setCollapsedInboxParents((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  }, []);

  // Build flat navigation list from visible rows so keyboard traversal respects collapsed groups.
  const flatNavItems = useMemo((): NavEntry[] => {
    return buildInboxKeyboardNavEntries(groupedSections, collapsedGroupKeys, collapsedInboxParents);
  }, [collapsedGroupKeys, collapsedInboxParents, groupedSections]);
  const topFlatIndex = useMemo(() => {
    const map = new Map<string, number>();
    flatNavItems.forEach((entry, index) => {
      if (entry.type === "top") map.set(entry.itemKey, index);
    });
    return map;
  }, [flatNavItems]);
  const childFlatIndex = useMemo(() => {
    const map = new Map<string, number>();
    flatNavItems.forEach((entry, index) => {
      if (entry.type === "child") map.set(entry.issueId, index);
    });
    return map;
  }, [flatNavItems]);
  const groupFlatIndex = useMemo(() => {
    const map = new Map<string, number>();
    flatNavItems.forEach((entry, index) => {
      if (entry.type === "group") map.set(entry.groupKey, index);
    });
    return map;
  }, [flatNavItems]);

  const agentName = (id: string | null) => {
    if (!id) return null;
    return agentById.get(id) ?? null;
  };
  const setIssueColumns = useCallback((next: InboxIssueColumn[]) => {
    const normalized = normalizeInboxIssueColumns(next);
    setVisibleIssueColumns(normalized);
    saveInboxIssueColumns(normalized);
  }, []);
  const toggleIssueColumn = useCallback((column: InboxIssueColumn, enabled: boolean) => {
    if (enabled) {
      setIssueColumns([...visibleIssueColumns, column]);
      return;
    }
    setIssueColumns(visibleIssueColumns.filter((value) => value !== column));
  }, [setIssueColumns, visibleIssueColumns]);
  const updateFilterPreferences = useCallback(
    (updater: (previous: InboxFilterPreferences) => InboxFilterPreferences) => {
      setFilterPreferences((previous) => {
        const next = updater(previous);
        saveInboxFilterPreferences(selectedCompanyId, next);
        return next;
      });
    },
    [selectedCompanyId],
  );
  const updateIssueFilters = useCallback((patch: Partial<IssueFilterState>) => {
    updateFilterPreferences((previous) => ({
      ...previous,
      issueFilters: { ...previous.issueFilters, ...patch },
    }));
  }, [updateFilterPreferences]);
  const updateAllCategoryFilter = useCallback((value: InboxCategoryFilter) => {
    updateFilterPreferences((previous) => ({ ...previous, allCategoryFilter: value }));
  }, [updateFilterPreferences]);
  const updateAllApprovalFilter = useCallback((value: InboxApprovalFilter) => {
    updateFilterPreferences((previous) => ({ ...previous, allApprovalFilter: value }));
  }, [updateFilterPreferences]);
  const updateGroupBy = useCallback((nextGroupBy: InboxWorkItemGroupBy) => {
    setGroupBy(nextGroupBy);
    saveInboxWorkItemGroupBy(nextGroupBy);
  }, []);

  const approveMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.approve(id),
    onSuccess: (_approval, id) => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
      navigate(`/approvals/${id}?resolved=approved`);
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Failed to approve");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.reject(id),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Failed to reject");
    },
  });

  const approveJoinMutation = useMutation({
    mutationFn: (joinRequest: JoinRequest) =>
      accessApi.approveJoinRequest(selectedCompanyId!, joinRequest.id),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.access.joinRequests(selectedCompanyId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sidebarBadges(selectedCompanyId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(selectedCompanyId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Failed to approve join request");
    },
  });

  const rejectJoinMutation = useMutation({
    mutationFn: (joinRequest: JoinRequest) =>
      accessApi.rejectJoinRequest(selectedCompanyId!, joinRequest.id),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.access.joinRequests(selectedCompanyId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sidebarBadges(selectedCompanyId!) });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Failed to reject join request");
    },
  });

  const [retryingRunIds, setRetryingRunIds] = useState<Set<string>>(new Set());

  const retryRunMutation = useMutation({
    mutationFn: async (run: HeartbeatRun) => {
      const payload: Record<string, unknown> = {};
      const context = run.contextSnapshot as Record<string, unknown> | null;
      if (context) {
        if (typeof context.issueId === "string" && context.issueId) payload.issueId = context.issueId;
        if (typeof context.taskId === "string" && context.taskId) payload.taskId = context.taskId;
        if (typeof context.taskKey === "string" && context.taskKey) payload.taskKey = context.taskKey;
      }
      const result = await agentsApi.wakeup(run.agentId, {
        source: "on_demand",
        triggerDetail: "manual",
        reason: "retry_failed_run",
        payload,
      });
      if (!("id" in result)) {
        throw new Error(result.message ?? "Retry was skipped.");
      }
      return { newRun: result, originalRun: run };
    },
    onMutate: (run) => {
      setRetryingRunIds((prev) => new Set(prev).add(run.id));
    },
    onSuccess: ({ newRun, originalRun }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.heartbeats(originalRun.companyId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.heartbeats(originalRun.companyId, originalRun.agentId) });
      navigate(`/agents/${originalRun.agentId}/runs/${newRun.id}`);
    },
    onSettled: (_data, _error, run) => {
      if (!run) return;
      setRetryingRunIds((prev) => {
        const next = new Set(prev);
        next.delete(run.id);
        return next;
      });
    },
  });

  const [fadingOutIssues, setFadingOutIssues] = useState<Set<string>>(new Set());
  const [showMarkAllReadConfirm, setShowMarkAllReadConfirm] = useState(false);
  const [archivingIssueIds, setArchivingIssueIds] = useState<Set<string>>(new Set());
  const [undoableArchiveIssueIds, setUndoableArchiveIssueIds] = useState<string[]>([]);
  const [unarchivingIssueIds, setUnarchivingIssueIds] = useState<Set<string>>(new Set());
  const [fadingNonIssueItems, setFadingNonIssueItems] = useState<Set<string>>(new Set());
  const [archivingNonIssueIds, setArchivingNonIssueIds] = useState<Set<string>>(new Set());
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const listRef = useRef<HTMLDivElement>(null);

  const invalidateInboxIssueQueries = () => {
    if (!selectedCompanyId) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.issues.listMineByMe(selectedCompanyId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.issues.listTouchedByMe(selectedCompanyId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.issues.listUnreadTouchedByMe(selectedCompanyId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.sidebarBadges(selectedCompanyId) });
  };

  const archiveIssueMutation = useMutation({
    mutationFn: (id: string) => issuesApi.archiveFromInbox(id),
    onMutate: async (id) => {
      setActionError(null);
      setArchivingIssueIds((prev) => new Set(prev).add(id));

      // Cancel in-flight refetches so they don't overwrite our optimistic update
      const queryKeys_ = [
        [...queryKeys.issues.listMineByMe(selectedCompanyId!), "with-routine-executions"],
        [...queryKeys.issues.listTouchedByMe(selectedCompanyId!), "with-routine-executions"],
        queryKeys.issues.listUnreadTouchedByMe(selectedCompanyId!),
      ];
      await Promise.all(queryKeys_.map((qk) => queryClient.cancelQueries({ queryKey: qk })));

      // Snapshot previous data for rollback
      const previousData = queryKeys_.map((qk) => [qk, queryClient.getQueryData(qk)] as const);

      // Optimistically remove the issue from all inbox query caches
      for (const qk of queryKeys_) {
        queryClient.setQueryData(qk, (old: unknown) => {
          if (!Array.isArray(old)) return old;
          return old.filter((issue: { id: string }) => issue.id !== id);
        });
      }

      return { previousData };
    },
    onError: (err, id, context) => {
      setActionError(err instanceof Error ? err.message : "Failed to archive issue");
      setArchivingIssueIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      // Restore previous query data on failure
      if (context?.previousData) {
        for (const [qk, data] of context.previousData) {
          queryClient.setQueryData(qk, data);
        }
      }
    },
    onSettled: (_data, _error, id) => {
      // Clean up archiving state and refetch to sync with server
      setArchivingIssueIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      invalidateInboxIssueQueries();
    },
    onSuccess: (_data, id) => {
      setUndoableArchiveIssueIds((prev) => [...prev.filter((issueId) => issueId !== id), id]);
    },
  });

  const unarchiveIssueMutation = useMutation({
    mutationFn: (id: string) => issuesApi.unarchiveFromInbox(id),
    onMutate: (id) => {
      setActionError(null);
      setUnarchivingIssueIds((prev) => new Set(prev).add(id));
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Failed to undo inbox archive");
    },
    onSuccess: (_data, id) => {
      setUndoableArchiveIssueIds((prev) => {
        const next = prev.filter((issueId) => issueId !== id);
        return next;
      });
    },
    onSettled: (_data, _error, id) => {
      setUnarchivingIssueIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      invalidateInboxIssueQueries();
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => issuesApi.markRead(id),
    onMutate: (id) => {
      setFadingOutIssues((prev) => new Set(prev).add(id));
    },
    onSuccess: () => {
      invalidateInboxIssueQueries();
    },
    onSettled: (_data, _error, id) => {
      setTimeout(() => {
        setFadingOutIssues((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 300);
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async (issueIds: string[]) => {
      await Promise.all(issueIds.map((issueId) => issuesApi.markRead(issueId)));
    },
    onMutate: (issueIds) => {
      setFadingOutIssues((prev) => {
        const next = new Set(prev);
        for (const issueId of issueIds) next.add(issueId);
        return next;
      });
    },
    onSuccess: () => {
      invalidateInboxIssueQueries();
    },
    onSettled: (_data, _error, issueIds) => {
      setTimeout(() => {
        setFadingOutIssues((prev) => {
          const next = new Set(prev);
          for (const issueId of issueIds) next.delete(issueId);
          return next;
        });
      }, 300);
    },
  });

  const markUnreadMutation = useMutation({
    mutationFn: (id: string) => issuesApi.markUnread(id),
    onSuccess: () => {
      invalidateInboxIssueQueries();
    },
  });

  const handleMarkNonIssueRead = useCallback((key: string) => {
    setFadingNonIssueItems((prev) => new Set(prev).add(key));
    markItemRead(key);
    setTimeout(() => {
      setFadingNonIssueItems((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 300);
  }, [markItemRead]);

  const handleArchiveNonIssue = useCallback((key: string) => {
    setArchivingNonIssueIds((prev) => new Set(prev).add(key));
    setTimeout(() => {
      if (key.startsWith("alert:")) {
        dismissAlert(key);
      } else {
        dismissInboxItem(key);
      }
      setArchivingNonIssueIds((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 200);
  }, [dismissAlert, dismissInboxItem]);

  const nonIssueUnreadState = (key: string): NonIssueUnreadState => {
    if (!canArchiveFromTab) return null;
    const isRead = readItems.has(key);
    const isFading = fadingNonIssueItems.has(key);
    if (isFading) return "fading";
    if (!isRead) return "visible";
    return "hidden";
  };

  // Keep selection valid when the list shape changes, but do not auto-select on initial load.
  useEffect(() => {
    setSelectedIndex((prev) => resolveInboxSelectionIndex(prev, flatNavItems.length));
  }, [flatNavItems.length]);

  useEffect(() => {
    setUndoableArchiveIssueIds([]);
    setUnarchivingIssueIds(new Set());
  }, [selectedCompanyId]);

  // Use refs for keyboard handler to avoid stale closures
  const kbStateRef = useRef({
    workItems: groupedSections,
    flatNavItems,
    selectedIndex,
    canArchive: canArchiveFromTab,
    nonInboxSearchIssueIds,
    archivingIssueIds,
    undoableArchiveIssueIds,
    unarchivingIssueIds,
    archivingNonIssueIds,
    fadingOutIssues,
    readItems,
  });
  kbStateRef.current = {
    workItems: groupedSections,
    flatNavItems,
    selectedIndex,
    canArchive: canArchiveFromTab,
    nonInboxSearchIssueIds,
    archivingIssueIds,
    undoableArchiveIssueIds,
    unarchivingIssueIds,
    archivingNonIssueIds,
    fadingOutIssues,
    readItems,
  };

  const kbActionsRef = useRef({
    archiveIssue: (id: string) => archiveIssueMutation.mutate(id),
    undoArchiveIssue: (id: string) => unarchiveIssueMutation.mutate(id),
    archiveNonIssue: handleArchiveNonIssue,
    markRead: (id: string) => markReadMutation.mutate(id),
    markUnreadIssue: (id: string) => markUnreadMutation.mutate(id),
    markNonIssueRead: handleMarkNonIssueRead,
    markNonIssueUnread: markItemUnread,
    setGroupCollapsed,
    navigate,
  });
  kbActionsRef.current = {
    archiveIssue: (id: string) => archiveIssueMutation.mutate(id),
    undoArchiveIssue: (id: string) => unarchiveIssueMutation.mutate(id),
    archiveNonIssue: handleArchiveNonIssue,
    markRead: (id: string) => markReadMutation.mutate(id),
    markUnreadIssue: (id: string) => markUnreadMutation.mutate(id),
    markNonIssueRead: handleMarkNonIssueRead,
    markNonIssueUnread: markItemUnread,
    setGroupCollapsed,
    navigate,
  };

  // Keyboard shortcuts (mail-client style) — single stable listener using refs
  useEffect(() => {
    if (!keyboardShortcutsEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;

      // Don't capture when typing in inputs/textareas or with modifier keys
      const target = e.target;
      if (
        !(target instanceof HTMLElement) ||
        isKeyboardShortcutTextInputTarget(target) ||
        hasBlockingShortcutDialog(document) ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      ) {
        return;
      }

      const st = kbStateRef.current;
      const act = kbActionsRef.current;

      // Keyboard shortcuts are only active on the "mine" tab
      if (!st.canArchive) return;

      const undoArchiveAction = resolveInboxUndoArchiveKeyAction({
        hasUndoableArchive: st.undoableArchiveIssueIds.length > 0,
        defaultPrevented: e.defaultPrevented,
        key: e.key,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        target,
        hasOpenDialog: hasBlockingShortcutDialog(document),
      });
      if (undoArchiveAction === "undo_archive") {
        const issueId = st.undoableArchiveIssueIds[st.undoableArchiveIssueIds.length - 1];
        if (!issueId || st.unarchivingIssueIds.has(issueId)) return;
        e.preventDefault();
        act.undoArchiveIssue(issueId);
        return;
      }

      const navItems = st.flatNavItems;
      const navCount = navItems.length;
      if (navCount === 0) return;

      /** Resolve the nav entry at selectedIndex to an issue (for child entries) or work item. */
      const resolveNavEntry = (idx: number): { issue?: Issue; item?: InboxWorkItem } => {
        const entry = navItems[idx];
        if (!entry) return {};
        if (entry.type === "child") return { issue: entry.issue };
        if (entry.type === "top") return { item: entry.item };
        return {};
      };

      switch (e.key) {
        case "j":
        case "ArrowDown": {
          e.preventDefault();
          setSelectedIndex((prev) => getInboxKeyboardSelectionIndex(prev, navCount, "next"));
          break;
        }
        case "k":
        case "ArrowUp": {
          e.preventDefault();
          setSelectedIndex((prev) => getInboxKeyboardSelectionIndex(prev, navCount, "previous"));
          break;
        }
        case "ArrowLeft":
        case "ArrowRight": {
          if (st.selectedIndex < 0 || st.selectedIndex >= navCount) return;
          const entry = navItems[st.selectedIndex];
          if (!entry || entry.type !== "group") return;
          e.preventDefault();
          act.setGroupCollapsed(entry.groupKey, e.key === "ArrowLeft");
          break;
        }
        case "a":
        case "y": {
          if (st.selectedIndex < 0 || st.selectedIndex >= navCount) return;
          e.preventDefault();
          const { issue, item } = resolveNavEntry(st.selectedIndex);
          if (issue) {
            if (!st.nonInboxSearchIssueIds.has(issue.id) && !st.archivingIssueIds.has(issue.id)) act.archiveIssue(issue.id);
          } else if (item) {
            if (item.kind === "issue") {
              if (!st.nonInboxSearchIssueIds.has(item.issue.id) && !st.archivingIssueIds.has(item.issue.id)) {
                act.archiveIssue(item.issue.id);
              }
            } else {
              const key = getInboxWorkItemKey(item);
              if (!st.archivingNonIssueIds.has(key)) act.archiveNonIssue(key);
            }
          }
          break;
        }
        case "U": {
          if (st.selectedIndex < 0 || st.selectedIndex >= navCount) return;
          e.preventDefault();
          const { issue, item } = resolveNavEntry(st.selectedIndex);
          if (issue) {
            act.markUnreadIssue(issue.id);
          } else if (item) {
            if (item.kind === "issue") act.markUnreadIssue(item.issue.id);
            else act.markNonIssueUnread(getInboxWorkItemKey(item));
          }
          break;
        }
        case "r": {
          if (st.selectedIndex < 0 || st.selectedIndex >= navCount) return;
          e.preventDefault();
          const { issue, item } = resolveNavEntry(st.selectedIndex);
          if (issue) {
            if (issue.isUnreadForMe && !st.fadingOutIssues.has(issue.id)) act.markRead(issue.id);
          } else if (item) {
            if (item.kind === "issue") {
              if (item.issue.isUnreadForMe && !st.fadingOutIssues.has(item.issue.id)) act.markRead(item.issue.id);
            } else {
              const key = getInboxWorkItemKey(item);
              if (!st.readItems.has(key)) act.markNonIssueRead(key);
            }
          }
          break;
        }
        case "Enter": {
          if (st.selectedIndex < 0 || st.selectedIndex >= navCount) return;
          e.preventDefault();
          const { issue, item } = resolveNavEntry(st.selectedIndex);
          if (issue) {
            const pathId = issue.identifier ?? issue.id;
            const detailState = armIssueDetailInboxQuickArchive(withIssueDetailHeaderSeed(issueLinkState, issue));
            rememberIssueDetailLocationState(pathId, detailState);
            void prefetchIssueDetail(queryClient, pathId, { issue });
            act.navigate(createIssueDetailPath(pathId), { state: detailState });
          } else if (item) {
            if (item.kind === "issue") {
              const pathId = item.issue.identifier ?? item.issue.id;
              const detailState = armIssueDetailInboxQuickArchive(
                withIssueDetailHeaderSeed(issueLinkState, item.issue),
              );
              rememberIssueDetailLocationState(pathId, detailState);
              void prefetchIssueDetail(queryClient, pathId, { issue: item.issue });
              act.navigate(createIssueDetailPath(pathId), { state: detailState });
            } else if (item.kind === "approval") {
              act.navigate(`/approvals/${item.approval.id}`);
            } else if (item.kind === "failed_run") {
              act.navigate(`/agents/${item.run.agentId}/runs/${item.run.id}`);
            }
          }
          break;
        }
        default:
          return;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [issueLinkState, keyboardShortcutsEnabled]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex < 0 || !listRef.current) return;
    const rows = listRef.current.querySelectorAll("[data-inbox-item]");
    const row = rows[selectedIndex];
    if (row) row.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!selectedCompanyId) {
    return <EmptyState icon={InboxIcon} message="Select a company to view inbox." />;
  }

  const hasRunFailures = failedRuns.length > 0;
  const showCompanyAlerts = shouldShowCompanyAlerts(tab) && showAlertsCategory;
  const showAggregateAgentError =
    showCompanyAlerts &&
    !!dashboard &&
    dashboard.agents.error > 0 &&
    !hasRunFailures &&
    !dismissedAlerts.has("alert:agent-errors");
  const showBudgetAlert =
    showCompanyAlerts &&
    !!dashboard &&
    dashboard.costs.monthBudgetCents > 0 &&
    dashboard.costs.monthUtilizationPercent >= 80 &&
    !dismissedAlerts.has("alert:budget");
  const hasAlerts = showAggregateAgentError || showBudgetAlert;
  const showWorkItemsSection = totalVisibleWorkItems > 0;
  const showAlertsSection = shouldShowInboxSection({
    tab,
    hasItems: hasAlerts,
    showOnMine: false,
    showOnRecent: false,
    showOnUnread: false,
    showOnAll: hasAlerts,
  });

  const visibleSections = [
    showAlertsSection ? "alerts" : null,
    showWorkItemsSection ? "work_items" : null,
  ].filter((key): key is SectionKey => key !== null);

  const allLoaded =
    !isJoinRequestsLoading &&
    !isApprovalsLoading &&
    !isDashboardLoading &&
    !isIssuesLoading &&
    !isMineIssuesLoading &&
    !isTouchedIssuesLoading &&
    !isRunsLoading;

  const markAllReadIssues = (tab === "mine" ? visibleMineIssues : unreadTouchedIssues)
    .filter((issue) => issue.isUnreadForMe && !fadingOutIssues.has(issue.id) && !archivingIssueIds.has(issue.id));
  const unreadIssueIds = markAllReadIssues
    .map((issue) => issue.id);
  const canMarkAllRead = unreadIssueIds.length > 0;
  const activeIssueFilterCount = countActiveIssueFilters(issueFilters, true);

  const tabCountByValue: Record<InboxTab, number | null> = {
    mine: visibleMineIssues.length || null,
    recent: visibleTouchedIssues.length || null,
    unread: unreadTouchedIssues.length || null,
    all: null,
  };

  const inboxAlertsBanner = showAlertsSection ? (
    <InboxAlertsBanner
      dashboard={dashboard!}
      showAgentError={showAggregateAgentError}
      showBudgetAlert={showBudgetAlert}
      onDismissAgentError={() => dismissAlert("alert:agent-errors")}
      onDismissBudgetAlert={() => dismissAlert("alert:budget")}
    />
  ) : null;

  return (
    <div className="space-y-4">
      <InboxToolbar
        tab={tab}
        tabCountByValue={tabCountByValue}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        nestingEnabled={nestingEnabled}
        onToggleNesting={toggleNesting}
        issueFilters={issueFilters}
        onIssueFiltersChange={updateIssueFilters}
        activeIssueFilterCount={activeIssueFilterCount}
        agents={agents}
        creators={creatorOptions}
        projects={projects}
        labels={labels}
        currentUserId={currentUserId}
        isolatedWorkspacesEnabled={isolatedWorkspacesEnabled}
        executionWorkspaces={executionWorkspaces}
        groupBy={groupBy}
        onGroupByChange={updateGroupBy}
        availableIssueColumns={availableIssueColumns}
        visibleIssueColumnSet={visibleIssueColumnSet}
        onToggleIssueColumn={toggleIssueColumn}
        onResetIssueColumns={() => setIssueColumns(DEFAULT_INBOX_ISSUE_COLUMNS)}
        canMarkAllRead={canMarkAllRead}
        unreadIssueCount={unreadIssueIds.length}
        showMarkAllReadConfirm={showMarkAllReadConfirm}
        onShowMarkAllReadConfirmChange={setShowMarkAllReadConfirm}
        markAllReadMutation={markAllReadMutation}
        onConfirmMarkAllRead={() => markAllReadMutation.mutate(unreadIssueIds)}
        allCategoryFilter={allCategoryFilter}
        onAllCategoryFilterChange={updateAllCategoryFilter}
        allApprovalFilter={allApprovalFilter}
        onAllApprovalFilterChange={updateAllApprovalFilter}
        showApprovalsCategory={showApprovalsCategory}
      />
      {inboxAlertsBanner}

      {approvalsError && <p className="text-sm text-destructive">{approvalsError.message}</p>}
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {!allLoaded && visibleSections.length === 0 && (
        <PageSkeleton variant="inbox" />
      )}

      {allLoaded && visibleSections.length === 0 && (
        <EmptyState
          icon={searchQuery.trim() ? Search : InboxIcon}
          message={
            searchQuery.trim()
              ? "No inbox items match your search."
              : tab === "mine"
              ? "Inbox zero."
              : tab === "unread"
              ? "No new inbox items."
              : tab === "recent"
                ? "No recent inbox items."
                : "No inbox items match these filters."
          }
        />
      )}

      {showWorkItemsSection && (
        <InboxWorkList
          listRef={listRef}
          groupedSections={groupedSections}
          groupBy={groupBy}
          nestingEnabled={nestingEnabled}
          collapsedGroupKeys={collapsedGroupKeys}
          collapsedInboxParents={collapsedInboxParents}
          selectedIndex={selectedIndex}
          setSelectedIndex={setSelectedIndex}
          canArchiveFromTab={canArchiveFromTab}
          groupFlatIndex={groupFlatIndex}
          topFlatIndex={topFlatIndex}
          childFlatIndex={childFlatIndex}
          fadingOutIssues={fadingOutIssues}
          archivingIssueIds={archivingIssueIds}
          archivingNonIssueIds={archivingNonIssueIds}
          projectById={projectById}
          companyUserProfileMap={companyUserProfileMap}
          liveIssueIds={liveIssueIds}
          issueLinkState={issueLinkState}
          visibleIssueColumnSet={visibleIssueColumnSet}
          availableIssueColumnSet={availableIssueColumnSet}
          visibleTrailingIssueColumns={visibleTrailingIssueColumns}
          issueById={issueById}
          agentName={agentName}
          currentUserId={currentUserId}
          companyUserLabelMap={companyUserLabelMap}
          executionWorkspaceById={executionWorkspaceById}
          projectWorkspaceById={projectWorkspaceById}
          defaultProjectWorkspaceIdByProjectId={defaultProjectWorkspaceIdByProjectId}
          markReadMutation={markReadMutation}
          archiveIssueMutation={archiveIssueMutation}
          approveMutation={approveMutation}
          rejectMutation={rejectMutation}
          retryRunMutation={retryRunMutation}
          retryingRunIds={retryingRunIds}
          approveJoinMutation={approveJoinMutation}
          rejectJoinMutation={rejectJoinMutation}
          dismissInboxItem={dismissInboxItem}
          nonIssueUnreadState={nonIssueUnreadState}
          handleMarkNonIssueRead={handleMarkNonIssueRead}
          handleArchiveNonIssue={handleArchiveNonIssue}
          openCreateIssueForGroup={openCreateIssueForGroup}
          toggleGroupCollapse={toggleGroupCollapse}
          toggleInboxParentCollapse={toggleInboxParentCollapse}
        />
      )}
    </div>
  );
}
