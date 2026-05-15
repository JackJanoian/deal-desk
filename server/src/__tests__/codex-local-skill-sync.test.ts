import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listCodexSkills,
  syncCodexSkills,
} from "@paperclipai/adapter-codex-local/server";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

describe("codex local skill sync", () => {
  const paperclipKey = "paperclipai/paperclip/paperclip";
  const createAgentKey = "paperclipai/paperclip/paperclip-create-agent";
  const cleanupDirs = new Set<string>();

  function convertedPaperclipSkill(source: string) {
    return {
      key: paperclipKey,
      runtimeName: "paperclip",
      source,
      sourceKind: "deal_desk",
    };
  }

  afterEach(async () => {
    await Promise.all(Array.from(cleanupDirs).map((dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it("reports converted Deal Desk skills that keep Paperclip-compatible keys", async () => {
    const codexHome = await makeTempDir("paperclip-codex-skill-sync-");
    const skillDir = await makeTempDir("paperclip-codex-skill-src-");
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
        paperclipSkillSync: {
          desiredSkills: [paperclipKey],
        },
        paperclipRuntimeSkills: [convertedPaperclipSkill(skillDir)],
      },
    } as const;

    const before = await listCodexSkills(ctx);
    expect(before.mode).toBe("ephemeral");
    expect(before.desiredSkills).toContain(paperclipKey);
    expect(before.desiredSkills).not.toContain(createAgentKey);
    expect(before.entries.find((entry) => entry.key === paperclipKey)?.state).toBe("configured");
    expect(before.entries.find((entry) => entry.key === createAgentKey)).toBeUndefined();
  });

  it("does not persist Paperclip skills into CODEX_HOME during sync", async () => {
    const codexHome = await makeTempDir("paperclip-codex-skill-prune-");
    const skillDir = await makeTempDir("paperclip-codex-skill-prune-src-");
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
        paperclipSkillSync: {
          desiredSkills: [paperclipKey],
        },
        paperclipRuntimeSkills: [convertedPaperclipSkill(skillDir)],
      },
    } as const;

    const after = await syncCodexSkills(configuredCtx, [paperclipKey]);
    expect(after.mode).toBe("ephemeral");
    expect(after.desiredSkills).toContain(paperclipKey);
    expect(after.entries.find((entry) => entry.key === paperclipKey)?.state).toBe("configured");
    await expect(fs.lstat(path.join(codexHome, "skills", "paperclip"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("does not keep bundled Paperclip skills configured when the desired set is emptied", async () => {
    const codexHome = await makeTempDir("paperclip-codex-skill-required-");
    cleanupDirs.add(codexHome);

    const configuredCtx = {
      agentId: "agent-2",
      companyId: "company-1",
      adapterType: "codex_local",
      config: {
        env: {
          CODEX_HOME: codexHome,
        },
        paperclipSkillSync: {
          desiredSkills: [],
        },
      },
    } as const;

    const after = await syncCodexSkills(configuredCtx, []);
    expect(after.desiredSkills).not.toContain(paperclipKey);
    expect(after.desiredSkills).not.toContain(createAgentKey);
    expect(after.entries.find((entry) => entry.key === paperclipKey)).toBeUndefined();
    expect(after.entries.find((entry) => entry.key === createAgentKey)).toBeUndefined();
  });

  it("normalizes legacy flat refs for converted Deal Desk skills", async () => {
    const codexHome = await makeTempDir("paperclip-codex-legacy-skill-sync-");
    const skillDir = await makeTempDir("paperclip-codex-legacy-skill-src-");
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
        paperclipSkillSync: {
          desiredSkills: ["paperclip"],
        },
        paperclipRuntimeSkills: [convertedPaperclipSkill(skillDir)],
      },
    });

    expect(snapshot.warnings).toEqual([]);
    expect(snapshot.desiredSkills).toContain(paperclipKey);
    expect(snapshot.desiredSkills).not.toContain("paperclip");
    expect(snapshot.entries.find((entry) => entry.key === paperclipKey)?.state).toBe("configured");
    expect(snapshot.entries.find((entry) => entry.key === "paperclip")).toBeUndefined();
  });
});
