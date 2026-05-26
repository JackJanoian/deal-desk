import { Link } from "@/lib/router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { deriveInitials } from "./Identity";
import { IssueReferenceActivitySummary } from "./IssueReferenceActivitySummary";
import { timeAgo } from "../lib/timeAgo";
import { cn } from "../lib/utils";
import { formatActivityVerb } from "../lib/activity-format";
import { deriveProjectUrlKey, type ActivityEvent, type Agent } from "@dealdesk/shared";
import type { CompanyUserProfile } from "../lib/company-members";

function entityLink(entityType: string, entityId: string, name?: string | null): string | null {
  switch (entityType) {
    case "issue": return `/issues/${name ?? entityId}`;
    case "agent": return `/agents/${entityId}`;
    case "project": return `/projects/${deriveProjectUrlKey(name, entityId)}`;
    case "approval": return `/approvals/${entityId}`;
    default: return null;
  }
}

interface ActivityRowProps {
  event: ActivityEvent;
  agentMap: Map<string, Agent>;
  userProfileMap?: Map<string, CompanyUserProfile>;
  entityNameMap: Map<string, string>;
  entityTitleMap?: Map<string, string>;
  className?: string;
}

export function ActivityRow({ event, agentMap, userProfileMap, entityNameMap, entityTitleMap, className }: ActivityRowProps) {
  const verb = formatActivityVerb(event.action, event.details, { agentMap, userProfileMap });

  const isHeartbeatEvent = event.entityType === "heartbeat_run";
  const heartbeatAgentId = isHeartbeatEvent
    ? (event.details as Record<string, unknown> | null)?.agentId as string | undefined
    : undefined;

  const name = isHeartbeatEvent
    ? (heartbeatAgentId ? entityNameMap.get(`agent:${heartbeatAgentId}`) : null)
    : entityNameMap.get(`${event.entityType}:${event.entityId}`);

  const entityTitle = entityTitleMap?.get(`${event.entityType}:${event.entityId}`);

  const link = isHeartbeatEvent && heartbeatAgentId
    ? `/agents/${heartbeatAgentId}/runs/${event.entityId}`
    : entityLink(event.entityType, event.entityId, name);

  const actor = event.actorType === "agent" ? agentMap.get(event.actorId) : null;
  const userProfile = event.actorType === "user" ? userProfileMap?.get(event.actorId) : null;
  const actorName = actor?.name ?? (event.actorType === "system" ? "System" : userProfile?.label ?? (event.actorType === "user" ? "Board" : event.actorId || "Unknown"));
  const actorAvatarUrl = userProfile?.image ?? null;

  const referenceSummary = (
    <div className="mt-1.5 pl-7">
      <IssueReferenceActivitySummary event={event} />
    </div>
  );

  const inner = (
    <>
      <div className="flex min-h-10 items-center gap-2.5">
        <Avatar size="xs" className="shrink-0">
          {actorAvatarUrl && <AvatarImage src={actorAvatarUrl} alt={actorName} />}
          <AvatarFallback>{deriveInitials(actorName)}</AvatarFallback>
        </Avatar>
        <p className="min-w-0 flex-1 truncate text-sm leading-snug">
          <span className="text-foreground">{actorName}</span>
          <span className="text-muted-foreground"> {verb} </span>
          {name ? <span className="font-medium text-foreground">{name}</span> : null}
          {entityTitle ? (
            <span className="text-muted-foreground"> — {entityTitle}</span>
          ) : null}
        </p>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {timeAgo(event.createdAt)}
        </span>
      </div>
      {referenceSummary}
    </>
  );

  const classes = cn(
    "px-3 py-2 text-sm sm:px-4",
    link && "cursor-pointer hover:bg-accent/30 transition-colors",
    className,
  );

  if (link) {
    return (
      <Link to={link} className={cn(classes, "no-underline text-inherit block")}>
        {inner}
      </Link>
    );
  }

  return (
    <div className={classes}>
      {inner}
    </div>
  );
}
