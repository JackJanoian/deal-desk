import { Skeleton } from "@/components/ui/skeleton";

interface PageSkeletonProps {
  variant?:
    | "list"
    | "issues-list"
    | "detail"
    | "dashboard"
    | "approvals"
    | "costs"
    | "inbox"
    | "org-chart";
}

export function PageSkeleton({ variant = "list" }: PageSkeletonProps) {
  if (variant === "dashboard") {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>

        <Skeleton className="h-[300px] w-full rounded-lg border border-border/70" />

        <Skeleton className="h-14 w-full rounded-lg border border-border/70" />

        <div className="rounded-lg border border-border/70 overflow-hidden divide-y divide-border/60">
          <div className="grid grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-none" />
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-lg border border-border/70" />
          <Skeleton className="h-64 w-full rounded-lg border border-border/70" />
        </div>

        <Skeleton className="h-10 w-32" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-lg border border-border/70" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "approvals") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-44" />
        </div>
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "costs") {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-28" />
          ))}
        </div>

        <Skeleton className="h-40 w-full" />

        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    );
  }

  if (variant === "inbox") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-full sm:hidden" />
        <div className="flex h-10 items-center gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="hidden h-8 flex-1 sm:block" />
          <Skeleton className="h-8 w-24" />
        </div>

        <div className="rounded-lg border border-border/70 overflow-hidden divide-y divide-border/60">
          {Array.from({ length: 8 }).map((_, row) => (
            <Skeleton key={row} className="h-11 w-full rounded-none" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "org-chart") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[calc(100vh-4rem)] w-full rounded-xl border border-border/70" />
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-3 w-64" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6" />
            <Skeleton className="h-6 w-6" />
            <Skeleton className="h-7 w-48" />
          </div>
          <Skeleton className="h-4 w-40" />
        </div>

        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (variant === "issues-list") {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-9 w-64" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>

        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <div className="space-y-1 rounded-lg border border-border/70 bg-card/35 p-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full rounded-md" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-9 w-44" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>

      <div className="space-y-1 rounded-lg border border-border/70 bg-card/35 p-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}
