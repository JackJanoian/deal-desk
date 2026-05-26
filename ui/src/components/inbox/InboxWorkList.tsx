import type { ReactNode, RefObject } from "react";
import type { UseMutationResult } from "@tanstack/react-query";
import type {
  HeartbeatRun,
  Issue,
  JoinRequest,
} from "@dealdesk/shared";
import { ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListSurface } from "../ListSurface";
import { IssueGroupHeader } from "../IssueGroupHeader";
import {
  InboxIssueMetaLeading,
  InboxIssueTrailingColumns,
  issueActivityText,
} from "../IssueColumns";
import { IssueRow } from "../IssueRow";
import { SwipeToArchive } from "../SwipeToArchive";
import { ApprovalInboxRow } from "./ApprovalInboxRow";
import { FailedRunInboxRow } from "./FailedRunInboxRow";
import { JoinRequestInboxRow } from "./JoinRequestInboxRow";
import { formatAssigneeUserLabel } from "../../lib/assignees";
import type { CompanyUserProfile } from "../../lib/company-members";
import {
  getInboxWorkItemKey,
  resolveIssueWorkspaceName,
  type InboxExecutionWorkspaceLookup,
  type InboxGroupedSection,
  type InboxIssueColumn,
  type InboxProjectWorkspaceLookup,
  type InboxWorkItemGroupBy,
} from "../../lib/inbox";
import type { NonIssueUnreadState } from "./inboxFormatters";
import { cn } from "../../lib/utils";

export interface InboxWorkListProps {
  listRef: RefObject<HTMLDivElement | null>;
  groupedSections: InboxGroupedSection[];
  groupBy: InboxWorkItemGroupBy;
  nestingEnabled: boolean;
  collapsedGroupKeys: Set<string>;
  collapsedInboxParents: Set<string>;
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  canArchiveFromTab: boolean;
  groupFlatIndex: Map<string, number>;
  topFlatIndex: Map<string, number>;
  childFlatIndex: Map<string, number>;
  fadingOutIssues: Set<string>;
  archivingIssueIds: Set<string>;
  archivingNonIssueIds: Set<string>;
  projectById: Map<string, { name: string; color: string | null }>;
  companyUserProfileMap: Map<string, CompanyUserProfile>;
  liveIssueIds: Set<string>;
  issueLinkState: unknown;
  visibleIssueColumnSet: Set<InboxIssueColumn>;
  availableIssueColumnSet: Set<InboxIssueColumn>;
  visibleTrailingIssueColumns: InboxIssueColumn[];
  issueById: Map<string, Issue>;
  agentName: (id: string | null) => string | null;
  currentUserId: string | null;
  companyUserLabelMap: Map<string, string>;
  executionWorkspaceById: Map<string, InboxExecutionWorkspaceLookup>;
  projectWorkspaceById: Map<string, InboxProjectWorkspaceLookup>;
  defaultProjectWorkspaceIdByProjectId: Map<string, string>;
  markReadMutation: UseMutationResult<unknown, Error, string, unknown>;
  archiveIssueMutation: UseMutationResult<unknown, Error, string, unknown>;
  approveMutation: UseMutationResult<unknown, Error, string, unknown>;
  rejectMutation: UseMutationResult<unknown, Error, string, unknown>;
  retryRunMutation: UseMutationResult<unknown, Error, HeartbeatRun, unknown>;
  retryingRunIds: Set<string>;
  approveJoinMutation: UseMutationResult<unknown, Error, JoinRequest, unknown>;
  rejectJoinMutation: UseMutationResult<unknown, Error, JoinRequest, unknown>;
  dismissInboxItem: (key: string) => void;
  nonIssueUnreadState: (key: string) => NonIssueUnreadState;
  handleMarkNonIssueRead: (key: string) => void;
  handleArchiveNonIssue: (key: string) => void;
  openCreateIssueForGroup: (group: InboxGroupedSection) => void;
  toggleGroupCollapse: (groupKey: string) => void;
  toggleInboxParentCollapse: (parentId: string) => void;
}

export function InboxWorkList({
  listRef,
  groupedSections,
  groupBy,
  nestingEnabled,
  collapsedGroupKeys,
  collapsedInboxParents,
  selectedIndex,
  setSelectedIndex,
  canArchiveFromTab,
  groupFlatIndex,
  topFlatIndex,
  childFlatIndex,
  fadingOutIssues,
  archivingIssueIds,
  archivingNonIssueIds,
  projectById,
  companyUserProfileMap,
  liveIssueIds,
  issueLinkState,
  visibleIssueColumnSet,
  availableIssueColumnSet,
  visibleTrailingIssueColumns,
  issueById,
  agentName,
  currentUserId,
  companyUserLabelMap,
  executionWorkspaceById,
  projectWorkspaceById,
  defaultProjectWorkspaceIdByProjectId,
  markReadMutation,
  archiveIssueMutation,
  approveMutation,
  rejectMutation,
  retryRunMutation,
  retryingRunIds,
  approveJoinMutation,
  rejectJoinMutation,
  dismissInboxItem,
  nonIssueUnreadState,
  handleMarkNonIssueRead,
  handleArchiveNonIssue,
  openCreateIssueForGroup,
  toggleGroupCollapse,
  toggleInboxParentCollapse,
}: InboxWorkListProps) {
  return (
    <ListSurface withoutDividers className="bg-card/30">
      <div ref={listRef} className="overflow-hidden">
{(() => {
    const renderInboxIssue = ({
      issue,
      depth,
      selected,
      hasChildren = false,
      isExpanded = false,
      childCount = 0,
      collapseParentId = null,
      allowArchive = canArchiveFromTab,
    }: {
      issue: Issue;
      depth: number;
      selected: boolean;
      hasChildren?: boolean;
      isExpanded?: boolean;
      childCount?: number;
      collapseParentId?: string | null;
      allowArchive?: boolean;
    }) => {
      const isUnread = issue.isUnreadForMe && !fadingOutIssues.has(issue.id);
      const isFading = fadingOutIssues.has(issue.id);
      const isArchiving = archivingIssueIds.has(issue.id);
      const project = issue.projectId ? projectById.get(issue.projectId) ?? null : null;
      const assigneeUserProfile = issue.assigneeUserId
        ? companyUserProfileMap.get(issue.assigneeUserId) ?? null
        : null;
      return (
        <IssueRow
          key={`issue:${issue.id}`}
          issue={issue}
          issueLinkState={issueLinkState}
          selected={selected}
          className={
            isArchiving
              ? "pointer-events-none -translate-x-4 scale-[0.98] opacity-0 transition-all duration-200 ease-out"
              : "transition-all duration-200 ease-out"
          }
          desktopMetaLeading={
            <>
              {nestingEnabled ? (
                depth === 0 && hasChildren && collapseParentId ? (
                  <button
                    type="button"
                    className="hidden w-4 shrink-0 items-center justify-center sm:inline-flex"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      toggleInboxParentCollapse(collapseParentId);
                    }}
                  >
                    <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-90")} />
                  </button>
                ) : (
                  <span className="hidden w-4 shrink-0 sm:block" />
                )
              ) : null}
              {depth > 0 ? <span className="hidden w-4 shrink-0 sm:block" /> : null}
              <InboxIssueMetaLeading
                issue={issue}
                isLive={liveIssueIds.has(issue.id)}
                showStatus={visibleIssueColumnSet.has("status") && availableIssueColumnSet.has("status")}
                showIdentifier={visibleIssueColumnSet.has("id") && availableIssueColumnSet.has("id")}
              />
            </>
          }
          titleSuffix={hasChildren && !isExpanded && depth === 0 ? (
            <span className="ml-1.5 text-xs text-muted-foreground">
              ({childCount} sub-task{childCount !== 1 ? "s" : ""})
            </span>
          ) : undefined}
          mobileMeta={issueActivityText(issue).toLowerCase()}
          mobileLeading={
            depth === 0 && hasChildren && collapseParentId ? (
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  toggleInboxParentCollapse(collapseParentId);
                }}
              >
                <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-90")} />
              </button>
            ) : undefined
          }
          unreadState={isUnread ? "visible" : isFading ? "fading" : "hidden"}
          onMarkRead={() => markReadMutation.mutate(issue.id)}
          onArchive={allowArchive ? () => archiveIssueMutation.mutate(issue.id) : undefined}
          archiveDisabled={isArchiving || archiveIssueMutation.isPending}
          desktopTrailing={
            visibleTrailingIssueColumns.length > 0 ? (
              <InboxIssueTrailingColumns
                issue={issue}
                columns={visibleTrailingIssueColumns}
                projectName={project?.name ?? null}
                projectColor={project?.color ?? null}
                workspaceName={resolveIssueWorkspaceName(issue, {
                  executionWorkspaceById,
                  projectWorkspaceById,
                  defaultProjectWorkspaceIdByProjectId,
                })}
                assigneeName={agentName(issue.assigneeAgentId)}
                assigneeUserName={
                  formatAssigneeUserLabel(issue.assigneeUserId, currentUserId, companyUserLabelMap)
                  ?? assigneeUserProfile?.label
                  ?? null
                }
                assigneeUserAvatarUrl={assigneeUserProfile?.image ?? null}
                currentUserId={currentUserId}
                parentIdentifier={issue.parentId ? (issueById.get(issue.parentId)?.identifier ?? null) : null}
                parentTitle={issue.parentId ? (issueById.get(issue.parentId)?.title ?? null) : null}
              />
            ) : undefined
          }
        />
      );
    };

    let previousTimestamp = Number.POSITIVE_INFINITY;
    return groupedSections.flatMap((group, groupIndex) => {
      const elements: ReactNode[] = [];
      const isGroupCollapsed = collapsedGroupKeys.has(group.key);
      if (
        group.searchSection !== "none"
        && group.searchSection !== groupedSections[groupIndex - 1]?.searchSection
      ) {
        elements.push(
          <div
            key={`${group.searchSection}-search-divider`}
            className="flex items-center gap-3 border-y border-border/70 bg-muted/30 px-4 py-2"
          >
            <div className="h-px flex-1 bg-border/80" />
            <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {group.searchSection === "archived" ? "Archived" : "Other results"}
            </span>
            <div className="h-px flex-1 bg-border/80" />
          </div>,
        );
      }
      if (group.label) {
        const groupNavIdx = groupFlatIndex.get(group.key) ?? -1;
        const isGroupSelected = groupNavIdx >= 0 && selectedIndex === groupNavIdx;
        const canCreateIssueInGroup = group.displayItems.some((item) => item.kind === "issue");
        elements.push(
          <div
            key={`group-${group.key}`}
            data-inbox-item
            className={cn(
              "px-3 sm:px-4",
              groupIndex > 0 && "pt-2",
              isGroupSelected && "bg-accent/50",
            )}
            onClick={() => {
              if (groupNavIdx >= 0) setSelectedIndex(groupNavIdx);
            }}
          >
            <IssueGroupHeader
              label={group.label}
              collapsible
              collapsed={isGroupCollapsed}
              onToggle={() => toggleGroupCollapse(group.key)}
              trailing={canCreateIssueInGroup ? (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="-mr-2 text-muted-foreground"
                  title={`New issue in ${group.label}`}
                  aria-label={`New issue in ${group.label}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    openCreateIssueForGroup(group);
                  }}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              ) : null}
            />
          </div>,
        );
      }
      if (isGroupCollapsed) return elements;

      for (let index = 0; index < group.displayItems.length; index += 1) {
        const item = group.displayItems[index]!;
        const navIdx = topFlatIndex.get(`${group.key}:${getInboxWorkItemKey(item)}`) ?? 0;
        const wrapItem = (key: string, isSelected: boolean, child: ReactNode) => (
          <div
            key={`sel-${key}`}
            data-inbox-item
            className="relative"
            onClick={() => setSelectedIndex(navIdx)}
          >
            {child}
          </div>
        );
        const todayCutoff = Date.now() - 24 * 60 * 60 * 1000;
        const showTodayDivider =
          groupBy === "none" &&
          item.timestamp > 0 &&
          item.timestamp < todayCutoff &&
          previousTimestamp >= todayCutoff;
        previousTimestamp = item.timestamp > 0 ? item.timestamp : previousTimestamp;
        if (showTodayDivider) {
          elements.push(
            <div key={`today-divider-${group.key}-${index}`} className="my-2 flex items-center gap-3 px-4">
              <div className="flex-1 border-t border-zinc-600" />
              <span className="shrink-0 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Earlier
              </span>
            </div>,
          );
        }
        const isSelected = selectedIndex === navIdx;

        if (item.kind === "approval") {
          const approvalKey = `approval:${item.approval.id}`;
          const isArchiving = archivingNonIssueIds.has(approvalKey);
          const row = (
            <ApprovalInboxRow
              key={approvalKey}
              approval={item.approval}
              selected={isSelected}
              requesterName={agentName(item.approval.requestedByAgentId)}
              onApprove={() => approveMutation.mutate(item.approval.id)}
              onReject={() => rejectMutation.mutate(item.approval.id)}
              isPending={approveMutation.isPending || rejectMutation.isPending}
              unreadState={nonIssueUnreadState(approvalKey)}
              onMarkRead={() => handleMarkNonIssueRead(approvalKey)}
              onArchive={canArchiveFromTab ? () => handleArchiveNonIssue(approvalKey) : undefined}
              archiveDisabled={isArchiving}
              className={
                isArchiving
                  ? "pointer-events-none -translate-x-4 scale-[0.98] opacity-0 transition-all duration-200 ease-out"
                  : "transition-all duration-200 ease-out"
              }
            />
          );
          elements.push(wrapItem(approvalKey, isSelected, canArchiveFromTab ? (
            <SwipeToArchive
              key={approvalKey}
              selected={isSelected}
              disabled={isArchiving}
              onArchive={() => handleArchiveNonIssue(approvalKey)}
            >
              {row}
            </SwipeToArchive>
          ) : row));
          continue;
        }

        if (item.kind === "failed_run") {
          const runKey = `run:${item.run.id}`;
          const isArchiving = archivingNonIssueIds.has(runKey);
          const row = (
            <FailedRunInboxRow
              key={runKey}
              run={item.run}
              selected={isSelected}
              issueById={issueById}
              agentName={agentName(item.run.agentId)}
              issueLinkState={issueLinkState}
              onDismiss={() => dismissInboxItem(runKey)}
              onRetry={() => retryRunMutation.mutate(item.run)}
              isRetrying={retryingRunIds.has(item.run.id)}
              unreadState={nonIssueUnreadState(runKey)}
              onMarkRead={() => handleMarkNonIssueRead(runKey)}
              onArchive={canArchiveFromTab ? () => handleArchiveNonIssue(runKey) : undefined}
              archiveDisabled={isArchiving}
              className={
                isArchiving
                  ? "pointer-events-none -translate-x-4 scale-[0.98] opacity-0 transition-all duration-200 ease-out"
                  : "transition-all duration-200 ease-out"
              }
            />
          );
          elements.push(wrapItem(runKey, isSelected, canArchiveFromTab ? (
            <SwipeToArchive
              key={runKey}
              selected={isSelected}
              disabled={isArchiving}
              onArchive={() => handleArchiveNonIssue(runKey)}
            >
              {row}
            </SwipeToArchive>
          ) : row));
          continue;
        }

        if (item.kind === "join_request") {
          const joinKey = `join:${item.joinRequest.id}`;
          const isArchiving = archivingNonIssueIds.has(joinKey);
          const row = (
            <JoinRequestInboxRow
              key={joinKey}
              joinRequest={item.joinRequest}
              selected={isSelected}
              onApprove={() => approveJoinMutation.mutate(item.joinRequest)}
              onReject={() => rejectJoinMutation.mutate(item.joinRequest)}
              isPending={approveJoinMutation.isPending || rejectJoinMutation.isPending}
              unreadState={nonIssueUnreadState(joinKey)}
              onMarkRead={() => handleMarkNonIssueRead(joinKey)}
              onArchive={canArchiveFromTab ? () => handleArchiveNonIssue(joinKey) : undefined}
              archiveDisabled={isArchiving}
              className={
                isArchiving
                  ? "pointer-events-none -translate-x-4 scale-[0.98] opacity-0 transition-all duration-200 ease-out"
                  : "transition-all duration-200 ease-out"
              }
            />
          );
          elements.push(wrapItem(joinKey, isSelected, canArchiveFromTab ? (
            <SwipeToArchive
              key={joinKey}
              selected={isSelected}
              disabled={isArchiving}
              onArchive={() => handleArchiveNonIssue(joinKey)}
            >
              {row}
            </SwipeToArchive>
          ) : row));
          continue;
        }

        const issue = item.issue;
        const childIssues = group.childrenByIssueId.get(issue.id) ?? [];
        const hasChildren = childIssues.length > 0;
        const isExpanded = hasChildren && !collapsedInboxParents.has(issue.id);
        const canArchiveIssue = canArchiveFromTab && group.searchSection === "none";
        const renderChildIssueRows = (
          children: Issue[],
          depth: number,
          seen: ReadonlySet<string>,
        ): ReactNode[] =>
          children.flatMap((child) => {
            if (seen.has(child.id)) return [];
            const nextSeen = new Set(seen);
            nextSeen.add(child.id);
            const childNavIdx = childFlatIndex.get(child.id) ?? -1;
            const isChildSelected = selectedIndex === childNavIdx;
            const grandchildIssues = group.childrenByIssueId.get(child.id) ?? [];
            const childHasChildren = grandchildIssues.length > 0;
            const childIsExpanded = childHasChildren && !collapsedInboxParents.has(child.id);
            const childRow = renderInboxIssue({
              issue: child,
              depth,
              selected: isChildSelected,
              hasChildren: childHasChildren,
              isExpanded: childIsExpanded,
              childCount: grandchildIssues.length,
              collapseParentId: child.id,
              allowArchive: canArchiveIssue,
            });
            const isChildArchiving = archivingIssueIds.has(child.id);
            const row = (
              <div
                key={`sel-issue:${child.id}`}
                data-inbox-item
                className="relative"
                onClick={() => setSelectedIndex(childNavIdx)}
              >
                {canArchiveIssue ? (
                  <SwipeToArchive
                    key={`issue:${child.id}`}
                    selected={isChildSelected}
                    disabled={isChildArchiving || archiveIssueMutation.isPending}
                    onArchive={() => archiveIssueMutation.mutate(child.id)}
                  >
                    {childRow}
                  </SwipeToArchive>
                ) : childRow}
              </div>
            );

            return childIsExpanded
              ? [row, ...renderChildIssueRows(grandchildIssues, depth + 1, nextSeen)]
              : [row];
          });
        const parentRow = renderInboxIssue({
          issue,
          depth: 0,
          selected: isSelected,
          hasChildren,
          isExpanded,
          childCount: childIssues.length,
          collapseParentId: issue.id,
          allowArchive: canArchiveIssue,
        });

        elements.push(wrapItem(`issue:${issue.id}`, isSelected, canArchiveIssue ? (
          <SwipeToArchive
            key={`issue:${issue.id}`}
            selected={isSelected}
            disabled={archivingIssueIds.has(issue.id) || archiveIssueMutation.isPending}
            onArchive={() => archiveIssueMutation.mutate(issue.id)}
          >
            {parentRow}
          </SwipeToArchive>
        ) : parentRow));

        if (isExpanded) {
          elements.push(...renderChildIssueRows(childIssues, 1, new Set([issue.id])));
        }
      }

      return elements;
    });
})()}
      </div>
    </ListSurface>
  );
}
