import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listClaudeSkills,
  syncClaudeSkills,
} from "@dealdesk/adapter-claude-local/server";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function createSkillDir(root: string, name: string) {
  const skillDir = path.join(root, name);
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(path.join(skillDir, "SKILL.md"), `---\nname: ${name}\n---\n`, "utf8");
  return skillDir;
}

describe("claude local skill sync", () => {
  const dealdeskKey = "dealdesk/dealdesk/dealdesk";
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

  it("does not default to mounting built-in DealDesk skills", async () => {
    const snapshot = await listClaudeSkills({
      agentId: "agent-1",
      companyId: "company-1",
      adapterType: "claude_local",
      config: {},
    });

    expect(snapshot.mode).toBe("ephemeral");
    expect(snapshot.supported).toBe(true);
    expect(snapshot.desiredSkills).not.toContain(dealdeskKey);
    expect(snapshot.entries.find((entry) => entry.key === dealdeskKey)).toBeUndefined();
  });

  it("keeps explicit converted DealDesk skill selections without mutating a persistent home", async () => {
    const skillDir = await makeTempDir("dealdesk-claude-converted-skill-");
    cleanupDirs.add(skillDir);

    const snapshot = await syncClaudeSkills({
      agentId: "agent-2",
      companyId: "company-1",
      adapterType: "claude_local",
      config: {
        dealdeskSkillSync: {
          desiredSkills: [dealdeskKey],
        },
        dealDeskRuntimeSkills: [convertedDealDeskSkill(skillDir)],
      },
    }, [dealdeskKey]);

    expect(snapshot.desiredSkills).toContain(dealdeskKey);
    expect(snapshot.entries.find((entry) => entry.key === dealdeskKey)?.state).toBe("configured");
  });

  it("normalizes legacy flat refs for converted DealDesk skills", async () => {
    const skillDir = await makeTempDir("dealdesk-claude-legacy-skill-");
    cleanupDirs.add(skillDir);

    const snapshot = await listClaudeSkills({
      agentId: "agent-3",
      companyId: "company-1",
      adapterType: "claude_local",
      config: {
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

  it("shows host-level user-installed Claude skills as read-only external entries", async () => {
    const home = await makeTempDir("dealdesk-claude-user-skills-");
    cleanupDirs.add(home);
    await createSkillDir(path.join(home, ".claude", "skills"), "crack-python");

    const snapshot = await listClaudeSkills({
      agentId: "agent-4",
      companyId: "company-1",
      adapterType: "claude_local",
      config: {
        env: {
          HOME: home,
        },
      },
    });

    expect(snapshot.entries).toContainEqual(expect.objectContaining({
      key: "crack-python",
      runtimeName: "crack-python",
      state: "external",
      managed: false,
      origin: "user_installed",
      originLabel: "User-installed",
      locationLabel: "~/.claude/skills",
      readOnly: true,
      detail: "Installed outside DealDesk management in the Claude skills home.",
    }));
  });
});
