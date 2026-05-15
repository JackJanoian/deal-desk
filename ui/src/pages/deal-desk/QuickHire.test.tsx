import { describe, expect, it } from "vitest";
import {
  buildDealDeskQuickHirePayload,
  DEAL_DESK_SKILL_KEYS,
} from "./QuickHire";

describe("Deal Desk QuickHire", () => {
  it("attaches the converted Deal Desk skills to new agents", () => {
    const payload = buildDealDeskQuickHirePayload({
      name: " Atlanta HVAC Sourcer ",
      title: "",
      systemPrompt: "Source Atlanta HVAC companies.",
      budgetUsd: "50",
    });

    expect(payload).toMatchObject({
      name: "Atlanta HVAC Sourcer",
      title: "Atlanta HVAC Sourcer",
      role: "general",
      adapterType: "claude_local",
      desiredSkills: [...DEAL_DESK_SKILL_KEYS],
      budgetMonthlyCents: 5000,
    });
    expect(payload.instructionsBundle.files["AGENTS.md"]).toBe("Source Atlanta HVAC companies.");
    expect(payload).not.toHaveProperty("reportsTo");
  });

  it("includes reportsTo when set", () => {
    const managerId = "550e8400-e29b-41d4-a716-446655440000";
    const payload = buildDealDeskQuickHirePayload({
      name: "Analyst",
      title: "Analyst",
      systemPrompt: "Do work.",
      budgetUsd: "50",
      reportsTo: managerId,
    });

    expect(payload.reportsTo).toBe(managerId);
  });

  it("omits reportsTo when null or empty string", () => {
    const withoutNull = buildDealDeskQuickHirePayload({
      name: "Analyst",
      title: "Analyst",
      systemPrompt: "Do work.",
      budgetUsd: "50",
      reportsTo: null,
    });
    expect(withoutNull).not.toHaveProperty("reportsTo");

    const withoutEmpty = buildDealDeskQuickHirePayload({
      name: "Analyst",
      title: "Analyst",
      systemPrompt: "Do work.",
      budgetUsd: "50",
      reportsTo: "",
    });
    expect(withoutEmpty).not.toHaveProperty("reportsTo");
  });
});
