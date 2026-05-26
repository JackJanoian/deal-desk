import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureCodexSkillsInjected } from "@dealdesk/adapter-codex-local/server";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function createDealDeskRepoSkill(root: string, skillName: string) {
  await fs.mkdir(path.join(root, "server"), { recursive: true });
  await fs.mkdir(path.join(root, "packages", "adapter-utils"), { recursive: true });
  await fs.mkdir(path.join(root, "skills", skillName), { recursive: true });
  await fs.writeFile(path.join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
  await fs.writeFile(path.join(root, "package.json"), '{"name":"dealdesk"}\n', "utf8");
  await fs.writeFile(
    path.join(root, "skills", skillName, "SKILL.md"),
    `---\nname: ${skillName}\n---\n`,
    "utf8",
  );
}

async function createCustomSkill(root: string, skillName: string) {
  await fs.mkdir(path.join(root, "custom", skillName), { recursive: true });
  await fs.writeFile(
    path.join(root, "custom", skillName, "SKILL.md"),
    `---\nname: ${skillName}\n---\n`,
    "utf8",
  );
}

describe("codex local adapter skill injection", () => {
  const dealdeskKey = "dealdesk/dealdesk/dealdesk";
  const createAgentKey = "dealdesk/dealdesk/dealdesk-create-agent";
  const cleanupDirs = new Set<string>();

  afterEach(async () => {
    await Promise.all(Array.from(cleanupDirs).map((dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it("skips Codex DealDesk skills instead of repairing or injecting them", async () => {
    const currentRepo = await makeTempDir("dealdesk-codex-current-");
    const oldRepo = await makeTempDir("dealdesk-codex-old-");
    const skillsHome = await makeTempDir("dealdesk-codex-home-");
    cleanupDirs.add(currentRepo);
    cleanupDirs.add(oldRepo);
    cleanupDirs.add(skillsHome);

    await createDealDeskRepoSkill(currentRepo, "dealdesk");
    await createDealDeskRepoSkill(currentRepo, "dealdesk-create-agent");
    await createDealDeskRepoSkill(oldRepo, "dealdesk");
    await fs.symlink(path.join(oldRepo, "skills", "dealdesk"), path.join(skillsHome, "dealdesk"));

    const logs: Array<{ stream: "stdout" | "stderr"; chunk: string }> = [];
    await ensureCodexSkillsInjected(
      async (stream, chunk) => {
        logs.push({ stream, chunk });
      },
      {
        skillsHome,
        skillsEntries: [
          {
            key: dealdeskKey,
            runtimeName: "dealdesk",
            source: path.join(currentRepo, "skills", "dealdesk"),
          },
          {
            key: createAgentKey,
            runtimeName: "dealdesk-create-agent",
            source: path.join(currentRepo, "skills", "dealdesk-create-agent"),
          },
        ],
      },
    );

    expect(await fs.realpath(path.join(skillsHome, "dealdesk"))).toBe(
      await fs.realpath(path.join(oldRepo, "skills", "dealdesk")),
    );
    await expect(fs.lstat(path.join(skillsHome, "dealdesk-create-agent"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(logs.some((entry) => entry.chunk.includes("Codex skill"))).toBe(false);
  });

  it("preserves a custom Codex skill symlink outside DealDesk repo checkouts", async () => {
    const currentRepo = await makeTempDir("dealdesk-codex-current-");
    const customRoot = await makeTempDir("dealdesk-codex-custom-");
    const skillsHome = await makeTempDir("dealdesk-codex-home-");
    cleanupDirs.add(currentRepo);
    cleanupDirs.add(customRoot);
    cleanupDirs.add(skillsHome);

    await createDealDeskRepoSkill(currentRepo, "dealdesk");
    await createCustomSkill(customRoot, "dealdesk");
    await fs.symlink(path.join(customRoot, "custom", "dealdesk"), path.join(skillsHome, "dealdesk"));

    await ensureCodexSkillsInjected(async () => {}, {
      skillsHome,
      skillsEntries: [{
        key: dealdeskKey,
        runtimeName: "dealdesk",
        source: path.join(currentRepo, "skills", "dealdesk"),
      }],
    });

    expect(await fs.realpath(path.join(skillsHome, "dealdesk"))).toBe(
      await fs.realpath(path.join(customRoot, "custom", "dealdesk")),
    );
  });

  it("does not process broken symlinks for unavailable DealDesk repo skills", async () => {
    const currentRepo = await makeTempDir("dealdesk-codex-current-");
    const oldRepo = await makeTempDir("dealdesk-codex-old-");
    const skillsHome = await makeTempDir("dealdesk-codex-home-");
    cleanupDirs.add(currentRepo);
    cleanupDirs.add(oldRepo);
    cleanupDirs.add(skillsHome);

    await createDealDeskRepoSkill(currentRepo, "dealdesk");
    await createDealDeskRepoSkill(oldRepo, "agent-browser");
    const staleTarget = path.join(oldRepo, "skills", "agent-browser");
    await fs.symlink(staleTarget, path.join(skillsHome, "agent-browser"));
    await fs.rm(staleTarget, { recursive: true, force: true });

    const logs: Array<{ stream: "stdout" | "stderr"; chunk: string }> = [];
    await ensureCodexSkillsInjected(
      async (stream, chunk) => {
        logs.push({ stream, chunk });
      },
      {
        skillsHome,
        skillsEntries: [{
          key: dealdeskKey,
          runtimeName: "dealdesk",
          source: path.join(currentRepo, "skills", "dealdesk"),
        }],
      },
    );

    expect((await fs.lstat(path.join(skillsHome, "agent-browser"))).isSymbolicLink()).toBe(true);
    expect(logs.some((entry) => entry.chunk.includes('Removed stale Codex skill "agent-browser"'))).toBe(false);
  });

  it("preserves existing DealDesk symlinks but does not add missing ones", async () => {
    const currentRepo = await makeTempDir("dealdesk-codex-current-");
    const skillsHome = await makeTempDir("dealdesk-codex-home-");
    cleanupDirs.add(currentRepo);
    cleanupDirs.add(skillsHome);

    await createDealDeskRepoSkill(currentRepo, "dealdesk");
    await createDealDeskRepoSkill(currentRepo, "agent-browser");
    await fs.symlink(
      path.join(currentRepo, "skills", "agent-browser"),
      path.join(skillsHome, "agent-browser"),
    );

    await ensureCodexSkillsInjected(async () => {}, {
      skillsHome,
      skillsEntries: [{
        key: dealdeskKey,
        runtimeName: "dealdesk",
        source: path.join(currentRepo, "skills", "dealdesk"),
      }],
    });

    await expect(fs.lstat(path.join(skillsHome, "dealdesk"))).rejects.toMatchObject({ code: "ENOENT" });
    expect((await fs.lstat(path.join(skillsHome, "agent-browser"))).isSymbolicLink()).toBe(true);
    expect(await fs.realpath(path.join(skillsHome, "agent-browser"))).toBe(
      await fs.realpath(path.join(currentRepo, "skills", "agent-browser")),
    );
  });
});
