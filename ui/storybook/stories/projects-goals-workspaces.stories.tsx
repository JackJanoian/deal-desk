import { useMemo, useState, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import type { Project } from "@dealdesk/shared";
import { Archive, Boxes, FolderGit2, GitBranch, Play, RotateCcw, Square } from "lucide-react";
import { ProjectProperties, type ProjectConfigFieldKey, type ProjectFieldSaveState } from "@/components/ProjectProperties";
import { ProjectWorkspacesContent } from "@/components/ProjectWorkspacesContent";
import { ProjectWorkspaceSummaryCard } from "@/components/ProjectWorkspaceSummaryCard";
import {
  WorkspaceRuntimeControls,
  buildWorkspaceRuntimeControlSections,
  type WorkspaceRuntimeControlRequest,
} from "@/components/WorkspaceRuntimeControls";
import { WorktreeBanner } from "@/components/WorktreeBanner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { queryKeys } from "@/lib/queryKeys";
import { buildProjectWorkspaceSummaries } from "@/lib/project-workspaces-tab";
import {
  storybookAgents,
  storybookAuthSession,
  storybookCompanies,
  storybookExecutionWorkspaces,
  storybookIssues,
  storybookProjectWorkspaces,
  storybookProjects,
} from "../fixtures/dealDeskData";

const COMPANY_ID = "company-storybook";
const boardProject = storybookProjects.find((project) => project.id === "project-board-ui") ?? storybookProjects[0]!;
const archivedProject =
  storybookProjects.find((project) => project.id === "project-archived-import")
  ?? storybookProjects[storybookProjects.length - 1]!;

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="dealdesk-story__frame overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <div className="dealdesk-story__label">{eyebrow}</div>
        <h2 className="mt-1 text-xl font-semibold">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function hydrateStorybookQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.setQueryData(queryKeys.auth.session, storybookAuthSession);
  queryClient.setQueryData(queryKeys.companies.all, { companies: storybookCompanies, unauthorized: false });
  queryClient.setQueryData(queryKeys.agents.list(COMPANY_ID), storybookAgents);
  queryClient.setQueryData(queryKeys.projects.list(COMPANY_ID), storybookProjects);
  queryClient.setQueryData(queryKeys.projects.detail(boardProject.id), boardProject);
  queryClient.setQueryData(queryKeys.projects.detail(boardProject.urlKey), boardProject);
  queryClient.setQueryData(queryKeys.projects.detail(archivedProject.id), archivedProject);
  queryClient.setQueryData(queryKeys.issues.list(COMPANY_ID), storybookIssues);
  queryClient.setQueryData(queryKeys.issues.listByProject(COMPANY_ID, boardProject.id), storybookIssues);
  queryClient.setQueryData(queryKeys.secrets.list(COMPANY_ID), []);
  queryClient.setQueryData(queryKeys.instance.experimentalSettings, {
    enableIsolatedWorkspaces: true,
    enableRoutineTriggers: true,
  });
  queryClient.setQueryData(queryKeys.executionWorkspaces.list(COMPANY_ID), storybookExecutionWorkspaces);
  queryClient.setQueryData(
    queryKeys.executionWorkspaces.list(COMPANY_ID, { projectId: boardProject.id }),
    storybookExecutionWorkspaces,
  );
  queryClient.setQueryData(
    queryKeys.executionWorkspaces.summaryList(COMPANY_ID),
    storybookExecutionWorkspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      mode: workspace.mode,
      projectWorkspaceId: workspace.projectWorkspaceId,
    })),
  );
}

function StorybookData({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [ready] = useState(() => {
    hydrateStorybookQueries(queryClient);
    return true;
  });

  return ready ? children : null;
}

function stateForProjectField(field: ProjectConfigFieldKey): ProjectFieldSaveState {
  if (field === "env" || field === "execution_workspace_branch_template") return "saved";
  if (field === "execution_workspace_worktree_parent_dir") return "saving";
  return "idle";
}

function ProjectPropertiesMatrix() {
  const editableProject: Project = useMemo(
    () => ({
      ...boardProject,
      env: {
        STORYBOOK_REVIEW: { type: "plain", value: "enabled" },
        OPENAI_API_KEY: { type: "secret_ref", secretId: "secret-openai", version: "latest" },
      },
    }),
    [],
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="rounded-lg border border-border bg-background p-4">
        <ProjectProperties
          project={editableProject}
          onFieldUpdate={() => undefined}
          getFieldSaveState={stateForProjectField}
          onArchive={() => undefined}
        />
      </div>
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">{archivedProject.name}</div>
              <div className="text-xs text-muted-foreground">Archived, no workspace configured</div>
            </div>
            <Badge variant="outline" className="gap-1">
              <Archive className="h-3 w-3" />
              archived
            </Badge>
          </div>
          <ProjectProperties
            project={archivedProject}
            onFieldUpdate={() => undefined}
            onArchive={() => undefined}
            archivePending={false}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          {[
            { label: "Issues", value: storybookIssues.filter((issue) => issue.projectId === boardProject.id).length, icon: FolderGit2 },
            { label: "Workspaces", value: boardProject.workspaces.length, icon: Boxes },
            { label: "Runtime services", value: boardProject.primaryWorkspace?.runtimeServices?.length ?? 0, icon: Play },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-lg border border-border bg-background p-4">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <div className="mt-3 text-2xl font-semibold">{item.value}</div>
                <div className="text-xs text-muted-foreground">{item.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WorkspacesMatrix() {
  const summaries = buildProjectWorkspaceSummaries({
    project: boardProject,
    issues: storybookIssues.filter((issue) => issue.projectId === boardProject.id),
    executionWorkspaces: storybookExecutionWorkspaces,
  });
  const localSummary = summaries.find((summary) => summary.kind === "project_workspace" && summary.workspaceId === "workspace-board-ui");
  const remoteSummary = summaries.find((summary) => summary.workspaceId === "workspace-docs-remote");
  const cleanupSummary = summaries.find((summary) => summary.executionWorkspaceStatus === "cleanup_failed");
  const featuredSummaries = [localSummary, remoteSummary, cleanupSummary].filter(
    (summary): summary is NonNullable<typeof summary> => Boolean(summary),
  );

  return (
    <div className="space-y-5">
      <ProjectWorkspacesContent
        companyId={COMPANY_ID}
        projectId={boardProject.id}
        projectRef={boardProject.urlKey}
        summaries={summaries}
      />
      <div className="grid gap-4 xl:grid-cols-3">
        {featuredSummaries.map((summary) => (
          <ProjectWorkspaceSummaryCard
            key={summary.key}
            projectRef={boardProject.urlKey}
            summary={summary}
            runtimeActionKey={summary.runningServiceCount > 0 ? `${summary.key}:stop` : null}
            runtimeActionPending={summary.runningServiceCount > 0}
            onRuntimeAction={() => undefined}
            onCloseWorkspace={() => undefined}
          />
        ))}
      </div>
      <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
        <ProjectWorkspacesContent
          companyId={COMPANY_ID}
          projectId={archivedProject.id}
          projectRef={archivedProject.urlKey}
          summaries={[]}
        />
      </div>
    </div>
  );
}

function RuntimeControlsMatrix() {
  const primaryWorkspace = storybookProjectWorkspaces[0]!;
  const remoteWorkspace = storybookProjectWorkspaces.find((workspace) => workspace.id === "workspace-docs-remote")!;
  const runningSections = buildWorkspaceRuntimeControlSections({
    runtimeConfig: primaryWorkspace.runtimeConfig?.workspaceRuntime,
    runtimeServices: primaryWorkspace.runtimeServices,
    canStartServices: true,
    canRunJobs: true,
  });
  const stoppedSections = buildWorkspaceRuntimeControlSections({
    runtimeConfig: remoteWorkspace.runtimeConfig?.workspaceRuntime,
    runtimeServices: remoteWorkspace.runtimeServices,
    canStartServices: true,
    canRunJobs: true,
  });
  const disabledSections = buildWorkspaceRuntimeControlSections({
    runtimeConfig: {
      commands: [
        { id: "web", name: "Web app", kind: "service", command: "pnpm dev" },
        { id: "migrate", name: "Migrate database", kind: "job", command: "pnpm db:migrate" },
      ],
    },
    runtimeServices: [],
    canStartServices: false,
    canRunJobs: false,
  });
  const pendingRequest: WorkspaceRuntimeControlRequest = {
    action: "restart",
    workspaceCommandId: "storybook",
    runtimeServiceId: "service-storybook",
    serviceIndex: 0,
  };

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Square className="h-4 w-4" />
            Running services
          </CardTitle>
          <CardDescription>Stop and restart actions with a pending request spinner.</CardDescription>
        </CardHeader>
        <CardContent>
          <WorkspaceRuntimeControls
            sections={runningSections}
            isPending
            pendingRequest={pendingRequest}
            onAction={() => undefined}
          />
        </CardContent>
      </Card>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-4 w-4" />
            Stopped remote preview
          </CardTitle>
          <CardDescription>Startable remote workspace service with URL history.</CardDescription>
        </CardHeader>
        <CardContent>
          <WorkspaceRuntimeControls sections={stoppedSections} onAction={() => undefined} />
        </CardContent>
      </Card>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Missing prerequisites
          </CardTitle>
          <CardDescription>Disabled runtime controls when no workspace path is available.</CardDescription>
        </CardHeader>
        <CardContent>
          <WorkspaceRuntimeControls
            sections={disabledSections}
            disabledHint="Add a workspace path before starting runtime services."
            square
            onAction={() => undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function setWorktreeMeta(name: string, content: string) {
  if (typeof document === "undefined") return;
  let element = document.querySelector(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("name", name);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function WorktreeBannerMatrix() {
  setWorktreeMeta("dealdesk-worktree-enabled", "true");
  setWorktreeMeta("dealdesk-worktree-name", "PAP-1675-projects-goals-workspaces");
  setWorktreeMeta("dealdesk-worktree-color", "#0f766e");
  setWorktreeMeta("dealdesk-worktree-text-color", "#ecfeff");

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <WorktreeBanner />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {[
          { label: "Branch", value: "PAP-1675-projects-goals-workspaces", icon: GitBranch },
          { label: "Workspace", value: "Project Storybook worktree", icon: FolderGit2 },
          { label: "Context", value: "visible before layout chrome", icon: Boxes },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-lg border border-border bg-background p-4">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <div className="mt-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">{item.label}</div>
              <div className="mt-1 break-all font-mono text-xs">{item.value}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProjectsGoalsWorkspacesStories() {
  return (
    <StorybookData>
      <div className="dealdesk-story">
        <main className="dealdesk-story__inner space-y-6">
          <section className="dealdesk-story__frame p-6">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <div className="dealdesk-story__label">Projects and workspaces</div>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">Thesis planning and runtime surfaces</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Fixture-backed project stories cover editable project properties, local and remote workspace
                  cards, cleanup failures, and runtime command controls.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">active</Badge>
                <Badge variant="outline">archived</Badge>
                <Badge variant="outline">local workspace</Badge>
                <Badge variant="outline">remote workspace</Badge>
              </div>
            </div>
          </section>

          <Section eyebrow="ProjectProperties" title="Full project detail panels with codebase, env, and archive states">
            <ProjectPropertiesMatrix />
          </Section>

          <Section eyebrow="ProjectWorkspacesContent" title="Workspace list with local, remote, cleanup-failed, and empty states">
            <WorkspacesMatrix />
          </Section>

          <Section eyebrow="WorkspaceRuntimeControls" title="Runtime start, stop, restart, and disabled command states">
            <RuntimeControlsMatrix />
          </Section>

          <Section eyebrow="WorktreeBanner" title="Worktree context banner with branch identity">
            <WorktreeBannerMatrix />
          </Section>
        </main>
      </div>
    </StorybookData>
  );
}

const meta = {
  title: "Product/Projects Workspaces",
  component: ProjectsGoalsWorkspacesStories,
  parameters: {
    docs: {
      description: {
        component:
          "Project and workspace stories cover project properties, workspace cards/lists, runtime controls, and worktree branding states.",
      },
    },
  },
} satisfies Meta<typeof ProjectsGoalsWorkspacesStories>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SurfaceMatrix: Story = {};
