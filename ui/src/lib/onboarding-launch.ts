export const ONBOARDING_PROJECT_NAME = "Onboarding";

export function buildOnboardingProjectPayload() {
  return {
    name: ONBOARDING_PROJECT_NAME,
    status: "in_progress" as const,
  };
}

export function buildOnboardingIssuePayload(input: {
  title: string;
  description: string;
  assigneeAgentId: string;
  projectId: string;
}) {
  const title = input.title.trim();
  const description = input.description.trim();

  return {
    title,
    ...(description ? { description } : {}),
    assigneeAgentId: input.assigneeAgentId,
    projectId: input.projectId,
    status: "todo" as const,
  };
}
