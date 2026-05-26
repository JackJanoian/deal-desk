import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "../api/projects";
import { useCompany } from "../context/CompanyContext";
import { useDialogActions } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EntityRow } from "../components/EntityRow";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { formatDate, projectUrl } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Hexagon, Plus } from "lucide-react";

export function Projects() {
  const { selectedCompanyId } = useCompany();
  const { openNewProject } = useDialogActions();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Projects" }]);
  }, [setBreadcrumbs]);

  const { data: allProjects, isLoading, error } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const projects = useMemo(
    () => (allProjects ?? []).filter((p) => !p.archivedAt),
    [allProjects],
  );

  if (!selectedCompanyId) {
    return <EmptyState icon={Hexagon} message="Select a company to view projects." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Group issues, budgets, and workspaces under shared delivery goals.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={openNewProject}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Project
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {!isLoading && projects.length === 0 && (
        <EmptyState
          icon={Hexagon}
          message="No projects yet."
          action="Add Project"
          onAction={openNewProject}
        />
      )}

      {projects.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">
            {projects.length} project{projects.length !== 1 ? "s" : ""}
          </p>
          <div className="overflow-hidden rounded-lg border border-border/70 bg-card/45">
            {projects.map((project) => (
              <EntityRow
                key={project.id}
                title={project.name}
                subtitle={project.description ?? undefined}
                to={projectUrl(project)}
                leading={
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: project.color ?? "#6366f1" }}
                  />
                }
                trailing={
                  <div className="flex items-center gap-3">
                    {project.targetDate && (
                      <span className="hidden text-xs text-muted-foreground sm:inline">
                        {formatDate(project.targetDate)}
                      </span>
                    )}
                    <StatusBadge status={project.status} />
                  </div>
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
