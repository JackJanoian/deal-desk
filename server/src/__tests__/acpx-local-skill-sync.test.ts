import { describe, expect, it } from "vitest";
import {
  listAcpxSkills,
  syncAcpxSkills,
} from "@dealdesk/adapter-acpx-local/server";

describe("acpx local skill sync", () => {
  const dealdeskKey = "dealdesk/dealdesk/dealdesk";
  const convertedRuntimeSkills = [{
    key: dealdeskKey,
    runtimeName: "dealdesk",
    source: "/tmp/dealdesk-deal-desk-skill",
    sourceKind: "deal_desk",
  }];

  it("reports ACPX Claude converted Deal Desk skills", async () => {
    const snapshot = await listAcpxSkills({
      agentId: "agent-1",
      companyId: "company-1",
      adapterType: "acpx_local",
      config: {
        agent: "claude",
        dealdeskSkillSync: {
          desiredSkills: [dealdeskKey],
        },
        dealDeskRuntimeSkills: convertedRuntimeSkills,
      },
    });

    expect(snapshot.adapterType).toBe("acpx_local");
    expect(snapshot.supported).toBe(true);
    expect(snapshot.mode).toBe("ephemeral");
    expect(snapshot.desiredSkills).toContain(dealdeskKey);
    expect(snapshot.entries.find((entry) => entry.key === dealdeskKey)?.state).toBe("configured");
    expect(snapshot.warnings).toEqual([]);
  });

  it("normalizes ACPX Codex legacy flat refs for converted Deal Desk skills", async () => {
    const snapshot = await syncAcpxSkills({
      agentId: "agent-2",
      companyId: "company-1",
      adapterType: "acpx_local",
      config: {
        agent: "codex",
        dealdeskSkillSync: {
          desiredSkills: ["dealdesk"],
        },
        dealDeskRuntimeSkills: convertedRuntimeSkills,
      },
    }, ["dealdesk"]);

    expect(snapshot.supported).toBe(true);
    expect(snapshot.mode).toBe("ephemeral");
    expect(snapshot.desiredSkills).toContain(dealdeskKey);
    expect(snapshot.desiredSkills).not.toContain("dealdesk");
    expect(snapshot.entries.find((entry) => entry.key === dealdeskKey)?.state).toBe("configured");
    expect(snapshot.warnings).toEqual([]);
  });

  it("tracks ACPX custom converted skill selection even when unsupported", async () => {
    const snapshot = await listAcpxSkills({
      agentId: "agent-3",
      companyId: "company-1",
      adapterType: "acpx_local",
      config: {
        agent: "custom",
        dealdeskSkillSync: {
          desiredSkills: [dealdeskKey],
        },
        dealDeskRuntimeSkills: convertedRuntimeSkills,
      },
    });

    expect(snapshot.supported).toBe(false);
    expect(snapshot.mode).toBe("unsupported");
    expect(snapshot.desiredSkills).toContain(dealdeskKey);
    expect(snapshot.entries.find((entry) => entry.key === dealdeskKey)?.state).toBe("configured");
    expect(snapshot.warnings).toContain(
      "Custom ACP commands do not expose a DealDesk skill integration contract yet; selected skills are tracked only.",
    );
  });
});
