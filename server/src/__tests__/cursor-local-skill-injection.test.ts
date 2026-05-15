import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureCursorSkillsInjected } from "@paperclipai/adapter-cursor-local/server";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function createSkillDir(root: string, name: string) {
  await fs.mkdir(path.join(root, name), { recursive: true });
}

describe("cursor local adapter skill injection", () => {
  const cleanupDirs = new Set<string>();

  afterEach(async () => {
    await Promise.all(Array.from(cleanupDirs).map((dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it("skips Paperclip skills when linking into Cursor skills home", async () => {
    const skillsDir = await makeTempDir("paperclip-cursor-skills-src-");
    const skillsHome = await makeTempDir("paperclip-cursor-skills-home-");
    cleanupDirs.add(skillsDir);
    cleanupDirs.add(skillsHome);

    await createSkillDir(skillsDir, "paperclip");
    await createSkillDir(skillsDir, "paperclip-create-agent");
    await fs.writeFile(path.join(skillsDir, "README.txt"), "ignore", "utf8");

    const logs: string[] = [];
    await ensureCursorSkillsInjected(
      async (_stream, chunk) => {
        logs.push(chunk);
      },
      { skillsDir, skillsHome },
    );

    await expect(fs.lstat(path.join(skillsHome, "paperclip"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(fs.lstat(path.join(skillsHome, "paperclip-create-agent"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(logs.some((line) => line.includes('Injected Cursor skill "paperclip"'))).toBe(false);
    expect(logs.some((line) => line.includes('Injected Cursor skill "paperclip-create-agent"'))).toBe(false);
  });

  it("preserves existing Paperclip targets and does not link missing Paperclip skills", async () => {
    const skillsDir = await makeTempDir("paperclip-cursor-preserve-src-");
    const skillsHome = await makeTempDir("paperclip-cursor-preserve-home-");
    cleanupDirs.add(skillsDir);
    cleanupDirs.add(skillsHome);

    await createSkillDir(skillsDir, "paperclip");
    await createSkillDir(skillsDir, "paperclip-create-agent");

    const existingTarget = path.join(skillsHome, "paperclip");
    await fs.mkdir(existingTarget, { recursive: true });
    await fs.writeFile(path.join(existingTarget, "keep.txt"), "keep", "utf8");

    await ensureCursorSkillsInjected(async () => {}, { skillsDir, skillsHome });

    expect((await fs.lstat(existingTarget)).isDirectory()).toBe(true);
    expect(await fs.readFile(path.join(existingTarget, "keep.txt"), "utf8")).toBe("keep");
    await expect(fs.lstat(path.join(skillsHome, "paperclip-create-agent"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("logs per-skill link failures and continues without throwing", async () => {
    const skillsDir = await makeTempDir("paperclip-cursor-fail-src-");
    const skillsHome = await makeTempDir("paperclip-cursor-fail-home-");
    cleanupDirs.add(skillsDir);
    cleanupDirs.add(skillsHome);

    await createSkillDir(skillsDir, "ok-skill");
    await createSkillDir(skillsDir, "fail-skill");

    const logs: string[] = [];
    await ensureCursorSkillsInjected(
      async (_stream, chunk) => {
        logs.push(chunk);
      },
      {
        skillsDir,
        skillsHome,
        linkSkill: async (source, target) => {
          if (target.endsWith(`${path.sep}fail-skill`)) {
            throw new Error("simulated link failure");
          }
          await fs.symlink(source, target);
        },
      },
    );

    expect((await fs.lstat(path.join(skillsHome, "ok-skill"))).isSymbolicLink()).toBe(true);
    await expect(fs.lstat(path.join(skillsHome, "fail-skill"))).rejects.toThrow();
    expect(logs.some((line) => line.includes('Failed to inject Cursor skill "fail-skill"'))).toBe(true);
  });
});
