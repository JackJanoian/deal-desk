import { useNavigate } from "@/lib/router";
import {
  shouldBlurPageSearchOnEnter,
  shouldBlurPageSearchOnEscape,
} from "../../lib/keyboardShortcuts";
import { Check, Layers, ListTree, Search } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";
import type { Agent, Approval, Issue, JoinRequest, Project } from "@dealdesk/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { PageTabBar } from "../PageTabBar";
import { PageToolbar } from "../PageToolbar";
import { IssueFiltersPopover } from "../IssueFiltersPopover";
import { IssueColumnPicker } from "../IssueColumns";
import { cn } from "../../lib/utils";
import {
  DEFAULT_INBOX_ISSUE_COLUMNS,
  type InboxApprovalFilter,
  type InboxCategoryFilter,
  type InboxIssueColumn,
  type InboxTab,
  type InboxWorkItemGroupBy,
} from "../../lib/inbox";
import type { IssueFilterState } from "../../lib/issue-filters";

type CreatorOption = {
  id: string;
  label: string;
  kind: "agent" | "user";
  searchText?: string;
};

export interface InboxToolbarProps {
  tab: InboxTab;
  tabCountByValue: Record<InboxTab, number | null>;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  nestingEnabled: boolean;
  onToggleNesting: () => void;
  issueFilters: IssueFilterState;
  onIssueFiltersChange: (patch: Partial<IssueFilterState>) => void;
  activeIssueFilterCount: number;
  agents?: Agent[];
  creators: CreatorOption[];
  projects?: Project[];
  labels?: Array<{ id: string; name: string; color: string }>;
  currentUserId: string | null;
  isolatedWorkspacesEnabled: boolean;
  executionWorkspaces: Array<{ id: string; name: string; mode: string }>;
  groupBy: InboxWorkItemGroupBy;
  onGroupByChange: (value: InboxWorkItemGroupBy) => void;
  availableIssueColumns: InboxIssueColumn[];
  visibleIssueColumnSet: Set<InboxIssueColumn>;
  onToggleIssueColumn: (column: InboxIssueColumn, enabled: boolean) => void;
  onResetIssueColumns: () => void;
  canMarkAllRead: boolean;
  unreadIssueCount: number;
  showMarkAllReadConfirm: boolean;
  onShowMarkAllReadConfirmChange: (open: boolean) => void;
  markAllReadMutation: UseMutationResult<unknown, Error, string[], unknown>;
  onConfirmMarkAllRead: () => void;
  allCategoryFilter: InboxCategoryFilter;
  onAllCategoryFilterChange: (value: InboxCategoryFilter) => void;
  allApprovalFilter: InboxApprovalFilter;
  onAllApprovalFilterChange: (value: InboxApprovalFilter) => void;
  showApprovalsCategory: boolean;
}

export function InboxToolbar({
  tab,
  tabCountByValue,
  searchQuery,
  onSearchQueryChange,
  nestingEnabled,
  onToggleNesting,
  issueFilters,
  onIssueFiltersChange,
  activeIssueFilterCount,
  agents,
  creators,
  projects,
  labels,
  currentUserId,
  isolatedWorkspacesEnabled,
  executionWorkspaces,
  groupBy,
  onGroupByChange,
  availableIssueColumns,
  visibleIssueColumnSet,
  onToggleIssueColumn,
  onResetIssueColumns,
  canMarkAllRead,
  unreadIssueCount,
  showMarkAllReadConfirm,
  onShowMarkAllReadConfirmChange,
  markAllReadMutation,
  onConfirmMarkAllRead,
  allCategoryFilter,
  onAllCategoryFilterChange,
  allApprovalFilter,
  onAllApprovalFilterChange,
  showApprovalsCategory,
}: InboxToolbarProps) {
  const navigate = useNavigate();

  const renderTabLabel = (label: string, value: InboxTab) => {
    const count = tabCountByValue[value];
    if (!count) return label;
    return (
      <span className="inline-flex items-center gap-1.5">
        {label}
        <span className="rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground tabular-nums">
          {count}
        </span>
      </span>
    );
  };

  const searchInput = (className: string) => (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Search inbox…"
        value={searchQuery}
        onChange={(e) => onSearchQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (shouldBlurPageSearchOnEnter({
            key: e.key,
            isComposing: e.nativeEvent.isComposing,
          })) {
            e.currentTarget.blur();
            return;
          }
          if (shouldBlurPageSearchOnEscape({
            key: e.key,
            isComposing: e.nativeEvent.isComposing,
            currentValue: e.currentTarget.value,
          })) {
            e.currentTarget.blur();
          }
        }}
        className="h-8 w-full pl-8 text-xs"
        data-page-search-target="true"
      />
    </div>
  );

  const categoryPills: Array<{ value: InboxCategoryFilter; label: string }> = [
    { value: "everything", label: "All" },
    { value: "issues_i_touched", label: "My issues" },
    { value: "approvals", label: "Approvals" },
    { value: "failed_runs", label: "Failed runs" },
    { value: "join_requests", label: "Join requests" },
    { value: "alerts", label: "Alerts" },
  ];

  const approvalPills: Array<{ value: InboxApprovalFilter; label: string }> = [
    { value: "all", label: "All approvals" },
    { value: "actionable", label: "Needs action" },
    { value: "resolved", label: "Resolved" },
  ];

  return (
    <div className="space-y-2">
      {searchInput("sm:hidden")}

      <PageToolbar
        leading={
          <Tabs value={tab} onValueChange={(value) => navigate(`/inbox/${value}`)}>
            <PageTabBar
              value={tab}
              onValueChange={(value) => navigate(`/inbox/${value}`)}
              items={[
                { value: "mine", label: renderTabLabel("Mine", "mine") },
                { value: "recent", label: renderTabLabel("Recent", "recent") },
                { value: "unread", label: renderTabLabel("Unread", "unread") },
                { value: "all", label: "All" },
              ]}
            />
          </Tabs>
        }
        center={searchInput("hidden sm:block w-[260px] ml-auto")}
        centerGrows={false}
        trailing={
          <>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={cn("hidden h-8 w-8 shrink-0 sm:inline-flex", nestingEnabled && "bg-accent")}
              onClick={onToggleNesting}
              title={nestingEnabled ? "Disable parent-child nesting" : "Enable parent-child nesting"}
            >
              <ListTree className="h-3.5 w-3.5" />
            </Button>
            <IssueFiltersPopover
              state={issueFilters}
              onChange={onIssueFiltersChange}
              activeFilterCount={activeIssueFilterCount}
              agents={agents}
              creators={creators}
              projects={projects?.map((project) => ({ id: project.id, name: project.name }))}
              labels={labels}
              currentUserId={currentUserId}
              enableRoutineVisibilityFilter
              buttonVariant="outline"
              iconOnly
              workspaces={
                isolatedWorkspacesEnabled
                  ? executionWorkspaces
                      .filter((w) => w.mode === "isolated_workspace")
                      .map((w) => ({ id: w.id, name: w.name }))
                  : undefined
              }
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className={cn("h-8 w-8 shrink-0", groupBy !== "none" && "bg-accent")}
                  title="Group"
                >
                  <Layers className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-40 p-2">
                <div className="space-y-0.5">
                  {([
                    ["none", "None"],
                    ["type", "Type"],
                    ["assignee", "Assignee"],
                    ["project", "Project"],
                    ...(isolatedWorkspacesEnabled ? ([["workspace", "Workspace"]] as const) : []),
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm",
                        groupBy === value ? "bg-accent/50 text-foreground" : "text-muted-foreground hover:bg-accent/50",
                      )}
                      onClick={() => onGroupByChange(value as InboxWorkItemGroupBy)}
                    >
                      <span>{label}</span>
                      {groupBy === value ? <Check className="h-3.5 w-3.5" /> : null}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <IssueColumnPicker
              availableColumns={availableIssueColumns}
              visibleColumnSet={visibleIssueColumnSet}
              onToggleColumn={onToggleIssueColumn}
              onResetColumns={onResetIssueColumns}
              title="Choose which inbox columns stay visible"
              iconOnly
            />
            {canMarkAllRead && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0"
                  onClick={() => onShowMarkAllReadConfirmChange(true)}
                  disabled={markAllReadMutation.isPending}
                >
                  {markAllReadMutation.isPending ? "Marking…" : "Mark all as read"}
                </Button>
                <Dialog open={showMarkAllReadConfirm} onOpenChange={onShowMarkAllReadConfirmChange}>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Mark all as read?</DialogTitle>
                      <DialogDescription>
                        This will mark {unreadIssueCount} unread {unreadIssueCount === 1 ? "item" : "items"} as read.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => onShowMarkAllReadConfirmChange(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={() => {
                          onShowMarkAllReadConfirmChange(false);
                          onConfirmMarkAllRead();
                        }}
                      >
                        Mark all as read
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </>
        }
      />

      {tab === "all" && (
        <div className="flex flex-wrap items-center gap-1.5">
          {categoryPills.map((pill) => {
            const active = allCategoryFilter === pill.value;
            return (
              <button
                key={pill.value}
                type="button"
                onClick={() => onAllCategoryFilterChange(pill.value)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  active
                    ? "border-primary/45 bg-primary/10 text-foreground"
                    : "border-border/70 text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                )}
              >
                {pill.label}
              </button>
            );
          })}
          {showApprovalsCategory && (
            <>
              <span className="mx-1 h-4 w-px bg-border/70" aria-hidden />
              {approvalPills.map((pill) => {
                const active = allApprovalFilter === pill.value;
                return (
                  <button
                    key={pill.value}
                    type="button"
                    onClick={() => onAllApprovalFilterChange(pill.value)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition-colors",
                      active
                        ? "border-primary/45 bg-primary/10 text-foreground"
                        : "border-border/70 text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                    )}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
