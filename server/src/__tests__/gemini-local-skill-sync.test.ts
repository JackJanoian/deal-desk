import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listGeminiSkills,
  syncGeminiSkills,
} from "@paperclipai/adapter-gemini-local/server";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function createSkillDir(root: string, name: string) {
  const skillDir = path.join(root, name);
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(path.join(skillDir, "SKILL.md"), `---\nname: ${name}\n---\n`, "utf8");
  return skillDir;
}

describe("gemini local skill sync", () => {
  const paperclipKey = "paperclipai/paperclip/paperclip";
  const cleanupDirs = new Set<string>();

  afterEach(async () => {
    await Promise.all(Array.from(cleanupDirs).map((dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it("installs converted Deal Desk skills that keep Paperclip-compatible keys", async () => {
    const home = await makeTempDir("paperclip-gemini-skill-sync-");
    const runtimeSkills = await makeTempDir("paperclip-gemini-skill-src-");
    cleanupDirs.add(home);
    cleanupDirs.add(runtimeSkills);
    const paperclipDir = await createSkillDir(runtimeSkills, "paperclip");

    const ctx = {
      agentId: "agent-1",
      companyId: "company-1",
      adapterType: "gemini_local",
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

    const before = await listGeminiSkills(ctx);
    expect(before.mode).toBe("persistent");
    expect(before.desiredSkills).toContain(paperclipKey);
    expect(before.entries.find((entry) => entry.key === paperclipKey)?.state).toBe("missing");

    const after = await syncGeminiSkills(ctx, [paperclipKey]);
    expect(after.desiredSkills).toContain(paperclipKey);
    expect(after.entries.find((entry) => entry.key === paperclipKey)?.state).toBe("installed");
    expect((await fs.lstat(path.join(home, ".gemini", "skills", "paperclip"))).isSymbolicLink()).toBe(true);
  });

  it("does not keep converted Deal Desk skills installed when the desired set is emptied", async () => {
    const home = await makeTempDir("paperclip-gemini-skill-prune-");
    const runtimeSkills = await makeTempDir("paperclip-gemini-skill-prune-src-");
    cleanupDirs.add(home);
    cleanupDirs.add(runtimeSkills);
    const paperclipDir = await createSkillDir(runtimeSkills, "paperclip");

    const configuredCtx = {
      agentId: "agent-2",
      companyId: "company-1",
      adapterType: "gemini_local",
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

    await syncGeminiSkills(configuredCtx, [paperclipKey]);

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

    const after = await syncGeminiSkills(clearedCtx, []);
    expect(after.desiredSkills).not.toContain(paperclipKey);
    expect(after.entries.find((entry) => entry.key === paperclipKey)?.state).toBe("available");
    await expect(fs.lstat(path.join(home, ".gemini", "skills", "paperclip"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});
