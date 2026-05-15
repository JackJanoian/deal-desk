import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listPiSkills,
  syncPiSkills,
} from "@paperclipai/adapter-pi-local/server";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function createSkillDir(root: string, name: string) {
  const skillDir = path.join(root, name);
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(path.join(skillDir, "SKILL.md"), `---\nname: ${name}\n---\n`, "utf8");
  return skillDir;
}

describe("pi local skill sync", () => {
  const paperclipKey = "paperclipai/paperclip/paperclip";
  const cleanupDirs = new Set<string>();

  afterEach(async () => {
    await Promise.all(Array.from(cleanupDirs).map((dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it("installs converted Deal Desk skills that keep Paperclip-compatible keys", async () => {
    const home = await makeTempDir("paperclip-pi-skill-sync-");
    const runtimeSkills = await makeTempDir("paperclip-pi-skill-src-");
    cleanupDirs.add(home);
    cleanupDirs.add(runtimeSkills);
    const paperclipDir = await createSkillDir(runtimeSkills, "paperclip");

    const ctx = {
      agentId: "agent-1",
      companyId: "company-1",
      adapterType: "pi_local",
      config: {
        env: {
          HOME: home,
        },
        paperclipSkillSync: {
          desiredSkills: [paperclipKey],
        },
        paperclipRuntimeSkills: [{
          key: paperclipKey,
          runtimeName: "paperclip",
          source: paperclipDir,
          sourceKind: "deal_desk",
        }],
      },
    } as const;

    const before = await listPiSkills(ctx);
    expect(before.mode).toBe("persistent");
    expect(before.desiredSkills).toContain(paperclipKey);
    expect(before.entries.find((entry) => entry.key === paperclipKey)?.state).toBe("missing");

    const after = await syncPiSkills(ctx, [paperclipKey]);
    expect(after.desiredSkills).toContain(paperclipKey);
    expect(after.entries.find((entry) => entry.key === paperclipKey)?.state).toBe("installed");
    expect((await fs.lstat(path.join(home, ".pi", "agent", "skills", "paperclip"))).isSymbolicLink()).toBe(true);
  });

  it("does not keep converted Deal Desk skills installed when the desired set is emptied", async () => {
    const home = await makeTempDir("paperclip-pi-skill-prune-");
    const runtimeSkills = await makeTempDir("paperclip-pi-skill-prune-src-");
    cleanupDirs.add(home);
    cleanupDirs.add(runtimeSkills);
    const paperclipDir = await createSkillDir(runtimeSkills, "paperclip");

    const configuredCtx = {
      agentId: "agent-2",
      companyId: "company-1",
      adapterType: "pi_local",
      config: {
        env: {
          HOME: home,
        },
        paperclipSkillSync: {
          desiredSkills: [paperclipKey],
        },
        paperclipRuntimeSkills: [{
          key: paperclipKey,
          runtimeName: "paperclip",
          source: paperclipDir,
          sourceKind: "deal_desk",
        }],
      },
    } as const;

    await syncPiSkills(configuredCtx, [paperclipKey]);

    const clearedCtx = {
      ...configuredCtx,
      config: {
        env: {
          HOME: home,
        },
        paperclipSkillSync: {
          desiredSkills: [],
        },
        paperclipRuntimeSkills: configuredCtx.config.paperclipRuntimeSkills,
      },
    } as const;

    const after = await syncPiSkills(clearedCtx, []);
    expect(after.desiredSkills).not.toContain(paperclipKey);
    expect(after.entries.find((entry) => entry.key === paperclipKey)?.state).toBe("available");
    await expect(fs.lstat(path.join(home, ".pi", "agent", "skills", "paperclip"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});
