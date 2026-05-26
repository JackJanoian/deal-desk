import { describe, expect, it } from "vitest";
import type { DealDeskPluginManifestV1 } from "@dealdesk/shared";
import { createTestHarness } from "@dealdesk/plugin-sdk/testing";

describe("plugin SDK test harness", () => {
  it("requires skills.managed capability before resetting a missing declaration", async () => {
    const manifest: DealDeskPluginManifestV1 = {
      id: "dealdesk.test-missing-managed-skill-capability",
      apiVersion: 1,
      version: "0.1.0",
      displayName: "Missing Managed Skill Capability",
      description: "Test plugin",
      author: "DealDesk",
      categories: ["automation"],
      capabilities: [],
      entrypoints: { worker: "./dist/worker.js" },
      skills: [{
        skillKey: "wiki-maintainer",
        displayName: "Wiki Maintainer",
      }],
    };
    const harness = createTestHarness({ manifest });

    await expect(harness.ctx.skills.managed.reset("unknown-skill", "company-1")).rejects.toThrow(
      "missing required capability 'skills.managed'",
    );
  });
});
