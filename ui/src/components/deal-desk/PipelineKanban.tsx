// DEAL DESK: Kanban board for deal pipeline stages.
import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { DdTarget, DdTargetStatus } from "../../api/dealDesk";
import { Badge } from "@/components/ui/badge";
import { FitScoreBadge } from "./TargetStatusBadge";
import {
  ACTIVE_PIPELINE_STATUSES,
  CLOSED_PIPELINE_STATUSES,
  daysInStage,
  isStaleInStage,
  statusLabel,
} from "./target-utils";

type PipelineKanbanProps = {
  targets: DdTarget[];
  onSelectTarget: (target: DdTarget) => void;
  onUpdateStatus: (targetId: string, status: DdTargetStatus) => void;
  showClosed?: boolean;
};

const ALL_COLUMNS = [...ACTIVE_PIPELINE_STATUSES, ...CLOSED_PIPELINE_STATUSES];

function PipelineCard({
  target,
  onSelect,
  isOverlay,
}: {
  target: DdTarget;
  onSelect: () => void;
  isOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: target.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging && !isOverlay ? 0.4 : 1,
  };

  const stale = isStaleInStage(target.status, target.statusChangedAt);
  const days = daysInStage(target.statusChangedAt);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      className={`dd-panel-subtle rounded-lg p-2.5 cursor-grab active:cursor-grabbing transition-[background-color,border-color,box-shadow,opacity] hover:border-primary/30 hover:bg-accent/30 ${
        isOverlay ? "shadow-lg rotate-1" : ""
      }`}
    >
      <div className="font-medium text-sm leading-tight text-foreground/92">{target.companyName}</div>
      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
        <FitScoreBadge score={target.fitScore} />
        {(target.sector || target.hqState) && (
          <span className="text-xs text-muted-foreground truncate">
            {[target.sector, target.hqState].filter(Boolean).join(" · ")}
          </span>
        )}
      </div>
      {days != null && (
        <div className="mt-1 text-xs text-muted-foreground">{days}d in stage</div>
      )}
      {stale && (
        <Badge variant="outline" className="mt-1.5 text-xs border-amber-500/50 text-amber-600">
          Stale
        </Badge>
      )}
    </div>
  );
}

function PipelineColumn({
  status,
  targets,
  onSelectTarget,
}: {
  status: DdTargetStatus;
  targets: DdTarget[];
  onSelectTarget: (target: DdTarget) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const isEmpty = targets.length === 0;

  return (
    <div
      className={`flex flex-col shrink-0 transition-[width,min-width] ${
        isEmpty && !isOver ? "min-w-[150px] w-[150px]" : "min-w-[232px] w-[232px]"
      }`}
    >
      <div
        className={`mb-1 flex items-center gap-2 rounded-md px-2 py-2 ${
          isEmpty && !isOver ? "justify-center" : "bg-muted/20"
        }`}
      >
        {(!isEmpty || isOver) && (
          <>
            <span className="dd-kicker">
              {statusLabel(status)}
            </span>
            <span className="text-xs text-muted-foreground/60 ml-auto tabular-nums">
              {targets.length}
            </span>
          </>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 rounded-lg border p-1.5 min-h-[120px] transition-colors ${
          isOver ? "border-primary/35 bg-primary/10 ring-1 ring-primary/30" : "border-border/60 bg-muted/20"
        }`}
      >
        <SortableContext items={targets.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {targets.map((target) => (
              <PipelineCard
                key={target.id}
                target={target}
                onSelect={() => onSelectTarget(target)}
              />
            ))}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

export function PipelineKanban({
  targets,
  onSelectTarget,
  onUpdateStatus,
  showClosed = false,
}: PipelineKanbanProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const columns = showClosed ? ALL_COLUMNS : ACTIVE_PIPELINE_STATUSES;

  const columnTargets = useMemo(() => {
    const grouped = Object.fromEntries(
      ALL_COLUMNS.map((s) => [s, [] as DdTarget[]]),
    ) as Record<DdTargetStatus, DdTarget[]>;
    for (const target of targets) {
      if (grouped[target.status]) {
        grouped[target.status].push(target);
      }
    }
    return grouped;
  }, [targets]);

  const activeTarget = useMemo(
    () => (activeId ? targets.find((t) => t.id === activeId) : null),
    [activeId, targets],
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const targetId = active.id as string;
    const target = targets.find((t) => t.id === targetId);
    if (!target) return;

    let targetStatus: DdTargetStatus | null = null;
    if (ALL_COLUMNS.includes(over.id as DdTargetStatus)) {
      targetStatus = over.id as DdTargetStatus;
    } else {
      const overTarget = targets.find((t) => t.id === over.id);
      if (overTarget) targetStatus = overTarget.status;
    }

    if (targetStatus && targetStatus !== target.status) {
      onUpdateStatus(targetId, targetStatus);
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2">
        {columns.map((status) => (
          <PipelineColumn
            key={status}
            status={status}
            targets={columnTargets[status] ?? []}
            onSelectTarget={onSelectTarget}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTarget ? (
          <PipelineCard target={activeTarget} onSelect={() => {}} isOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
