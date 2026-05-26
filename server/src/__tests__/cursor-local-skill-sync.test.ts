import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listCursorSkills,
  syncCursorSkills,
} from "@dealdesk/adapter-cursor-local/server";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function createSkillDir(root: string, name: string) {
  const skillDir = path.join(root, name);
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(path.join(skillDir, "SKILL.md"), `---\nname: ${name}\n---\n`, "utf8");
  return skillDir;
}

describe("cursor local skill sync", () => {
  const dealdeskKey = "dealdesk/dealdesk/dealdesk";
  const cleanupDirs = new Set<string>();

  afterEach(async () => {
    await Promise.all(Array.from(cleanupDirs).map((dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it("installs converted Deal Desk skills that keep DealDesk-compatible keys", async () => {
    const home = await makeTempDir("dealdesk-cursor-skill-sync-");
    const runtimeSkills = await makeTempDir("dealdesk-cursor-skill-src-");
    cleanupDirs.add(home);
    cleanupDirs.add(runtimeSkills);

    const paperclipDir = await createSkillDir(runtimeSkills, "dealdesk");

    const ctx = {
      agentId: "agent-1",
      companyId: "company-1",
      adapterType: "cursor",
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
          source: paperclipDir,
          sourceKind: "deal_desk",
        }],
      },
    } as const;

    const before = await listCursorSkills(ctx);
    expect(before.mode).toBe("persistent");
    expect(before.desiredSkills).toContain(dealdeskKey);
    expect(before.entries.find((entry) => entry.key === dealdeskKey)?.state).toBe("missing");

    const after = await syncCursorSkills(ctx, [dealdeskKey]);
    expect(after.desiredSkills).toContain(dealdeskKey);
    expect(after.entries.find((entry) => entry.key === dealdeskKey)?.state).toBe("installed");
    expect((await fs.lstat(path.join(home, ".cursor", "skills", "dealdesk"))).isSymbolicLink()).toBe(true);
  });

  it("recognizes company-library runtime skills supplied outside the bundled DealDesk directory", async () => {
    const home = await makeTempDir("dealdesk-cursor-runtime-skills-home-");
    const runtimeSkills = await makeTempDir("dealdesk-cursor-runtime-skills-src-");
    cleanupDirs.add(home);
    cleanupDirs.add(runtimeSkills);

    const paperclipDir = await createSkillDir(runtimeSkills, "dealdesk");
    const asciiHeartDir = await createSkillDir(runtimeSkills, "ascii-heart");

    const ctx = {
      agentId: "agent-3",
      companyId: "company-1",
      adapterType: "cursor",
      config: {
        env: {
          HOME: home,
        },
        dealDeskRuntimeSkills: [
          {
            key: "dealdesk",
            runtimeName: "dealdesk",
            source: paperclipDir,
            required: true,
            requiredReason: "Bundled DealDesk skills are always available for local adapters.",
            sourceKind: "dealdesk_bundled",
          },
          {
            key: "ascii-heart",
            runtimeName: "ascii-heart",
            source: asciiHeartDir,
          },
        ],
        dealdeskSkillSync: {
          desiredSkills: ["ascii-heart"],
        },
      },
    } as const;

    const before = await listCursorSkills(ctx);
    expect(before.warnings).toEqual([]);
    expect(before.desiredSkills).toEqual(["ascii-heart"]);
    expect(before.entries.find((entry) => entry.key === "dealdesk")).toBeUndefined();
    expect(before.entries.find((entry) => entry.key === "ascii-heart")?.state).toBe("missing");

    const after = await syncCursorSkills(ctx, ["ascii-heart"]);
    expect(after.warnings).toEqual([]);
    expect(after.entries.find((entry) => entry.key === "ascii-heart")?.state).toBe("installed");
    expect((await fs.lstat(path.join(home, ".cursor", "skills", "ascii-heart"))).isSymbolicLink()).toBe(true);
  });

  it("does not keep converted Deal Desk skills installed when the desired set is emptied", async () => {
    const home = await makeTempDir("dealdesk-cursor-skill-prune-");
    const runtimeSkills = await makeTempDir("dealdesk-cursor-skill-prune-src-");
    cleanupDirs.add(home);
    cleanupDirs.add(runtimeSkills);
    const paperclipDir = await createSkillDir(runtimeSkills, "dealdesk");

    const configuredCtx = {
      agentId: "agent-2",
      companyId: "company-1",
      adapterType: "cursor",
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
          source: paperclipDir,
          sourceKind: "deal_desk",
        }],
      },
    } as const;

    await syncCursorSkills(configuredCtx, [dealdeskKey]);

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

    const after = await syncCursorSkills(clearedCtx, []);
    expect(after.desiredSkills).not.toContain(dealdeskKey);
    expect(after.entries.find((entry) => entry.key === dealdeskKey)?.state).toBe("available");
    await expect(fs.lstat(path.join(home, ".cursor", "skills", "dealdesk"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});
