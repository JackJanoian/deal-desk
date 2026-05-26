import type { HeartbeatRun, JoinRequest } from "@dealdesk/shared";

function firstNonEmptyLine(value: string | null | undefined): string | null {
  if (!value) return null;
  const line = value.split("\n").map((chunk) => chunk.trim()).find(Boolean);
  return line ?? null;
}

export function runFailureMessage(run: HeartbeatRun): string {
  return firstNonEmptyLine(run.error) ?? firstNonEmptyLine(run.stderrExcerpt) ?? "Run exited with an error.";
}

export function approvalStatusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

export function readIssueIdFromRun(run: HeartbeatRun): string | null {
  const context = run.contextSnapshot;
  if (!context) return null;

  const issueId = context["issueId"];
  if (typeof issueId === "string" && issueId.length > 0) return issueId;

  const taskId = context["taskId"];
  if (typeof taskId === "string" && taskId.length > 0) return taskId;

  return null;
}

function nonEmptyLabel(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function formatJoinRequestInboxLabel(
  joinRequest: Pick<
    JoinRequest,
    "requestType" | "agentName" | "requestEmailSnapshot" | "requestingUserId"
  > & {
    requesterUser?: {
      name: string | null;
      email: string | null;
    } | null;
  },
) {
  if (joinRequest.requestType !== "human") {
    return `Agent join request${joinRequest.agentName ? `: ${joinRequest.agentName}` : ""}`;
  }

  const requesterName = nonEmptyLabel(joinRequest.requesterUser?.name);
  const requesterEmail =
    nonEmptyLabel(joinRequest.requesterUser?.email) ??
    nonEmptyLabel(joinRequest.requestEmailSnapshot);
  const requesterId = nonEmptyLabel(joinRequest.requestingUserId);

  if (requesterName && requesterEmail) return `${requesterName} (${requesterEmail})`;
  if (requesterEmail) return requesterEmail;
  if (requesterName) return requesterName;
  if (requesterId) return requesterId;
  return "Human join request";
}

export type NonIssueUnreadState = "visible" | "fading" | "hidden" | null;
