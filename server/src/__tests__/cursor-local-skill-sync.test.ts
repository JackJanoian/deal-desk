import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listCursorSkills,
  syncCursorSkills,
} from "@paperclipai/adapter-cursor-local/server";

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
  const paperclipKey = "paperclipai/paperclip/paperclip";
  const cleanupDirs = new Set<string>();

  afterEach(async () => {
    await Promise.all(Array.from(cleanupDirs).map((dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it("installs converted Deal Desk skills that keep Paperclip-compatible keys", async () => {
    const home = await makeTempDir("paperclip-cursor-skill-sync-");
    const runtimeSkills = await makeTempDir("paperclip-cursor-skill-src-");
    cleanupDirs.add(home);
    cleanupDirs.add(runtimeSkills);

    const paperclipDir = await createSkillDir(runtimeSkills, "paperclip");

    const ctx = {
      agentId: "agent-1",
      companyId: "company-1",
      adapterType: "cursor",
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

    const before = await listCursorSkills(ctx);
    expect(before.mode).toBe("persistent");
    expect(before.desiredSkills).toContain(paperclipKey);
    expect(before.entries.find((entry) => entry.key === paperclipKey)?.state).toBe("missing");

    const after = await syncCursorSkills(ctx, [paperclipKey]);
    expect(after.desiredSkills).toContain(paperclipKey);
    expect(after.entries.find((entry) => entry.key === paperclipKey)?.state).toBe("installed");
    expect((await fs.lstat(path.join(home, ".cursor", "skills", "paperclip"))).isSymbolicLink()).toBe(true);
  });

  it("recognizes company-library runtime skills supplied outside the bundled Paperclip directory", async () => {
    const home = await makeTempDir("paperclip-cursor-runtime-skills-home-");
    const runtimeSkills = await makeTempDir("paperclip-cursor-runtime-skills-src-");
    cleanupDirs.add(home);
    cleanupDirs.add(runtimeSkills);

    const paperclipDir = await createSkillDir(runtimeSkills, "paperclip");
    const asciiHeartDir = await createSkillDir(runtimeSkills, "ascii-heart");

    const ctx = {
      agentId: "agent-3",
      companyId: "company-1",
      adapterType: "cursor",
      config: {
        env: {
          HOME: home,
        },
        paperclipRuntimeSkills: [
          {
            key: "paperclip",
            runtimeName: "paperclip",
            source: paperclipDir,
            required: true,
            requiredReason: "Bundled Paperclip skills are always available for local adapters.",
            sourceKind: "paperclip_bundled",
          },
          {
            key: "ascii-heart",
            runtimeName: "ascii-heart",
            source: asciiHeartDir,
          },
        ],
        paperclipSkillSync: {
          desiredSkills: ["ascii-heart"],
        },
      },
    } as const;

    const before = await listCursorSkills(ctx);
    expect(before.warnings).toEqual([]);
    expect(before.desiredSkills).toEqual(["ascii-heart"]);
    expect(before.entries.find((entry) => entry.key === "paperclip")).toBeUndefined();
    expect(before.entries.find((entry) => entry.key === "ascii-heart")?.state).toBe("missing");

    const after = await syncCursorSkills(ctx, ["ascii-heart"]);
    expect(after.warnings).toEqual([]);
    expect(after.entries.find((entry) => entry.key === "ascii-heart")?.state).toBe("installed");
    expect((await fs.lstat(path.join(home, ".cursor", "skills", "ascii-heart"))).isSymbolicLink()).toBe(true);
  });

  it("does not keep converted Deal Desk skills installed when the desired set is emptied", async () => {
    const home = await makeTempDir("paperclip-cursor-skill-prune-");
    const runtimeSkills = await makeTempDir("paperclip-cursor-skill-prune-src-");
    cleanupDirs.add(home);
    cleanupDirs.add(runtimeSkills);
    const paperclipDir = await createSkillDir(runtimeSkills, "paperclip");

    const configuredCtx = {
      agentId: "agent-2",
      companyId: "company-1",
      adapterType: "cursor",
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

    await syncCursorSkills(configuredCtx, [paperclipKey]);

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

    const after = await syncCursorSkills(clearedCtx, []);
    expect(after.desiredSkills).not.toContain(paperclipKey);
    expect(after.entries.find((entry) => entry.key === paperclipKey)?.state).toBe("available");
    await expect(fs.lstat(path.join(home, ".cursor", "skills", "paperclip"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});
