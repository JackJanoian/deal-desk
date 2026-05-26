import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listCodexSkills,
  syncCodexSkills,
} from "@dealdesk/adapter-codex-local/server";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

describe("codex local skill sync", () => {
  const dealdeskKey = "dealdesk/dealdesk/dealdesk";
  const createAgentKey = "dealdesk/dealdesk/dealdesk-create-agent";
  const cleanupDirs = new Set<string>();

  function convertedDealDeskSkill(source: string) {
    return {
      key: dealdeskKey,
      runtimeName: "dealdesk",
      source,
      sourceKind: "deal_desk",
    };
  }

  afterEach(async () => {
    await Promise.all(Array.from(cleanupDirs).map((dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it("reports converted Deal Desk skills that keep DealDesk-compatible keys", async () => {
    const codexHome = await makeTempDir("dealdesk-codex-skill-sync-");
    const skillDir = await makeTempDir("dealdesk-codex-skill-src-");
    cleanupDirs.add(codexHome);
    cleanupDirs.add(skillDir);

    const ctx = {
      agentId: "agent-1",
      companyId: "company-1",
      adapterType: "codex_local",
      config: {
        env: {
          CODEX_HOME: codexHome,
        },
        dealdeskSkillSync: {
          desiredSkills: [dealdeskKey],
        },
        dealDeskRuntimeSkills: [convertedDealDeskSkill(skillDir)],
      },
    } as const;

    const before = await listCodexSkills(ctx);
    expect(before.mode).toBe("ephemeral");
    expect(before.desiredSkills).toContain(dealdeskKey);
    expect(before.desiredSkills).not.toContain(createAgentKey);
    expect(before.entries.find((entry) => entry.key === dealdeskKey)?.state).toBe("configured");
    expect(before.entries.find((entry) => entry.key === createAgentKey)).toBeUndefined();
  });

  it("does not persist DealDesk skills into CODEX_HOME during sync", async () => {
    const codexHome = await makeTempDir("dealdesk-codex-skill-prune-");
    const skillDir = await makeTempDir("dealdesk-codex-skill-prune-src-");
    cleanupDirs.add(codexHome);
    cleanupDirs.add(skillDir);

    const configuredCtx = {
      agentId: "agent-2",
      companyId: "company-1",
      adapterType: "codex_local",
      config: {
        env: {
          CODEX_HOME: codexHome,
        },
        dealdeskSkillSync: {
          desiredSkills: [dealdeskKey],
        },
        dealDeskRuntimeSkills: [convertedDealDeskSkill(skillDir)],
      },
    } as const;

    const after = await syncCodexSkills(configuredCtx, [dealdeskKey]);
    expect(after.mode).toBe("ephemeral");
    expect(after.desiredSkills).toContain(dealdeskKey);
    expect(after.entries.find((entry) => entry.key === dealdeskKey)?.state).toBe("configured");
    await expect(fs.lstat(path.join(codexHome, "skills", "dealdesk"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("does not keep bundled DealDesk skills configured when the desired set is emptied", async () => {
    const codexHome = await makeTempDir("dealdesk-codex-skill-required-");
    cleanupDirs.add(codexHome);

    const configuredCtx = {
      agentId: "agent-2",
      companyId: "company-1",
      adapterType: "codex_local",
      config: {
        env: {
          CODEX_HOME: codexHome,
        },
        dealdeskSkillSync: {
          desiredSkills: [],
        },
      },
    } as const;

    const after = await syncCodexSkills(configuredCtx, []);
    expect(after.desiredSkills).not.toContain(dealdeskKey);
    expect(after.desiredSkills).not.toContain(createAgentKey);
    expect(after.entries.find((entry) => entry.key === dealdeskKey)).toBeUndefined();
    expect(after.entries.find((entry) => entry.key === createAgentKey)).toBeUndefined();
  });

  it("normalizes legacy flat refs for converted Deal Desk skills", async () => {
    const codexHome = await makeTempDir("dealdesk-codex-legacy-skill-sync-");
    const skillDir = await makeTempDir("dealdesk-codex-legacy-skill-src-");
    cleanupDirs.add(codexHome);
    cleanupDirs.add(skillDir);

    const snapshot = await listCodexSkills({
      agentId: "agent-3",
      companyId: "company-1",
      adapterType: "codex_local",
      config: {
        env: {
          CODEX_HOME: codexHome,
        },
        dealdeskSkillSync: {
          desiredSkills: ["dealdesk"],
        },
        dealDeskRuntimeSkills: [convertedDealDeskSkill(skillDir)],
      },
    });

    expect(snapshot.warnings).toEqual([]);
    expect(snapshot.desiredSkills).toContain(dealdeskKey);
    expect(snapshot.desiredSkills).not.toContain("dealdesk");
    expect(snapshot.entries.find((entry) => entry.key === dealdeskKey)?.state).toBe("configured");
    expect(snapshot.entries.find((entry) => entry.key === "dealdesk")).toBeUndefined();
  });
});
