import { describe, expect, it } from "vitest";
import {
  buildOnboardingIssuePayload,
  buildOnboardingProjectPayload,
} from "./onboarding-launch";

describe("onboarding launch payloads", () => {
  it("creates the onboarding project without goal links", () => {
    expect(buildOnboardingProjectPayload()).toEqual({
      name: "Onboarding",
      status: "in_progress",
    });
  });

  it("creates the first onboarding issue without goal links", () => {
    expect(
      buildOnboardingIssuePayload({
        title: "  Hire your first engineer  ",
        description: "  Kick off the hiring plan  ",
        assigneeAgentId: "agent-1",
        projectId: "project-1",
      }),
    ).toEqual({
      title: "Hire your first engineer",
      description: "Kick off the hiring plan",
      assigneeAgentId: "agent-1",
      projectId: "project-1",
      status: "todo",
    });
  });
});
