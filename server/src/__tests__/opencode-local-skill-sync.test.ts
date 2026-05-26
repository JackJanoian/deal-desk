import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listOpenCodeSkills,
  syncOpenCodeSkills,
} from "@dealdesk/adapter-opencode-local/server";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function createSkillDir(root: string, name: string) {
  const skillDir = path.join(root, name);
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(path.join(skillDir, "SKILL.md"), `---\nname: ${name}\n---\n`, "utf8");
  return skillDir;
}

describe("opencode local skill sync", () => {
  const dealdeskKey = "dealdesk/dealdesk/dealdesk";
  const cleanupDirs = new Set<string>();

  afterEach(async () => {
    await Promise.all(Array.from(cleanupDirs).map((dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it("installs converted Deal Desk skills that keep DealDesk-compatible keys", async () => {
    const home = await makeTempDir("dealdesk-opencode-skill-sync-");
    const runtimeSkills = await makeTempDir("dealdesk-opencode-skill-src-");
    cleanupDirs.add(home);
    cleanupDirs.add(runtimeSkills);
    const dealdeskDir = await createSkillDir(runtimeSkills, "dealdesk");

    const ctx = {
      agentId: "agent-1",
      companyId: "company-1",
      adapterType: "opencode_local",
      config: {
        env: {
          HOME: home,
        },
        dealdeskSkillSync: {
          desiredSkills: [dealdeskKey],
        },
        dealDeskRuntimeSkills: [{
          key: dealdeskKey,
          runtimeName: "dealdesk",
          source: dealdeskDir,
          sourceKind: "deal_desk",
        }],
      },
    } as const;

    const before = await listOpenCodeSkills(ctx);
    expect(before.mode).toBe("persistent");
    expect(before.warnings).toContain("OpenCode currently uses the shared Claude skills home (~/.claude/skills).");
    expect(before.desiredSkills).toContain(dealdeskKey);
    expect(before.entries.find((entry) => entry.key === dealdeskKey)?.state).toBe("missing");

    const after = await syncOpenCodeSkills(ctx, [dealdeskKey]);
    expect(after.desiredSkills).toContain(dealdeskKey);
    expect(after.entries.find((entry) => entry.key === dealdeskKey)?.state).toBe("installed");
    expect((await fs.lstat(path.join(home, ".claude", "skills", "dealdesk"))).isSymbolicLink()).toBe(true);
  });

  it("does not keep converted Deal Desk skills installed when the desired set is emptied", async () => {
    const home = await makeTempDir("dealdesk-opencode-skill-prune-");
    const runtimeSkills = await makeTempDir("dealdesk-opencode-skill-prune-src-");
    cleanupDirs.add(home);
    cleanupDirs.add(runtimeSkills);
    const dealdeskDir = await createSkillDir(runtimeSkills, "dealdesk");

    const configuredCtx = {
      agentId: "agent-2",
      companyId: "company-1",
      adapterType: "opencode_local",
      config: {
        env: {
          HOME: home,
        },
        dealdeskSkillSync: {
          desiredSkills: [dealdeskKey],
        },
        dealDeskRuntimeSkills: [{
          key: dealdeskKey,
          runtimeName: "dealdesk",
          source: dealdeskDir,
          sourceKind: "deal_desk",
        }],
      },
    } as const;

    await syncOpenCodeSkills(configuredCtx, [dealdeskKey]);

    const clearedCtx = {
      ...configuredCtx,
      config: {
        env: {
          HOME: home,
        },
        dealdeskSkillSync: {
          desiredSkills: [],
        },
        dealDeskRuntimeSkills: configuredCtx.config.dealDeskRuntimeSkills,
      },
    } as const;

    const after = await syncOpenCodeSkills(clearedCtx, []);
    expect(after.desiredSkills).not.toContain(dealdeskKey);
    expect(after.entries.find((entry) => entry.key === dealdeskKey)?.state).toBe("available");
    await expect(fs.lstat(path.join(home, ".claude", "skills", "dealdesk"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});
