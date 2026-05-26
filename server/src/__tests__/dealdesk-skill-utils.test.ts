import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listDealDeskSkillEntries,
  readDealDeskRuntimeSkillEntries,
  removeMaintainerOnlySkillSymlinks,
} from "@dealdesk/adapter-utils/server-utils";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

describe("dealdesk skill utils", () => {
  const cleanupDirs = new Set<string>();

  afterEach(async () => {
    await Promise.all(Array.from(cleanupDirs).map((dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it("lists bundled runtime skills from ./skills without pulling in .agents/skills", async () => {
    const root = await makeTempDir("dealdesk-skill-roots-");
    cleanupDirs.add(root);

    const moduleDir = path.join(root, "a", "b", "c", "d", "e");
    await fs.mkdir(moduleDir, { recursive: true });
    await fs.mkdir(path.join(root, "skills", "dealdesk"), { recursive: true });
    await fs.mkdir(path.join(root, "skills", "dealdesk-create-agent"), { recursive: true });
    await fs.mkdir(path.join(root, ".agents", "skills", "release"), { recursive: true });

    const entries = await listDealDeskSkillEntries(moduleDir);

    expect(entries.map((entry) => entry.key)).toEqual([
      "dealdesk/dealdesk/dealdesk",
      "dealdesk/dealdesk/dealdesk-create-agent",
    ]);
    expect(entries.map((entry) => entry.runtimeName)).toEqual([
      "dealdesk",
      "dealdesk-create-agent",
    ]);
    expect(entries[0]?.source).toBe(path.join(root, "skills", "dealdesk"));
    expect(entries[1]?.source).toBe(path.join(root, "skills", "dealdesk-create-agent"));
  });

  it("does not use bundled DealDesk skills as runtime entries by fallback", async () => {
    const root = await makeTempDir("dealdesk-skill-runtime-fallback-");
    cleanupDirs.add(root);

    const moduleDir = path.join(root, "a", "b", "c", "d", "e");
    await fs.mkdir(moduleDir, { recursive: true });
    await fs.mkdir(path.join(root, "skills", "dealdesk"), { recursive: true });

    await expect(readDealDeskRuntimeSkillEntries({}, moduleDir)).resolves.toEqual([]);
  });

  it("keeps converted Deal Desk runtime skills while dropping true bundled DealDesk tools", async () => {
    const root = await makeTempDir("dealdesk-skill-runtime-config-");
    cleanupDirs.add(root);

    const convertedDir = path.join(root, "converted", "dealdesk");
    const bundledDir = path.join(root, "bundled", "dealdesk-create-agent");
    await fs.mkdir(convertedDir, { recursive: true });
    await fs.mkdir(bundledDir, { recursive: true });

    const entries = await readDealDeskRuntimeSkillEntries({
      dealDeskRuntimeSkills: [
        {
          key: "dealdesk/dealdesk/dealdesk",
          runtimeName: "dealdesk",
          source: convertedDir,
          sourceKind: "deal_desk",
        },
        {
          key: "dealdesk/dealdesk/dealdesk-create-agent",
          runtimeName: "dealdesk-create-agent",
          source: bundledDir,
          sourceKind: "dealdesk_bundled",
        },
      ],
    }, root);

    expect(entries.map((entry) => entry.key)).toEqual(["dealdesk/dealdesk/dealdesk"]);
    expect(entries[0]?.sourceKind).toBe("deal_desk");
  });

  it("marks skills with required: false in SKILL.md frontmatter as optional", async () => {
    const root = await makeTempDir("dealdesk-skill-optional-");
    cleanupDirs.add(root);

    const moduleDir = path.join(root, "a", "b", "c", "d", "e");
    await fs.mkdir(moduleDir, { recursive: true });

    // Required skill (no frontmatter flag)
    const requiredDir = path.join(root, "skills", "dealdesk");
    await fs.mkdir(requiredDir, { recursive: true });
    await fs.writeFile(path.join(requiredDir, "SKILL.md"), "---\nname: dealdesk\n---\n\n# DealDesk\n");

    // Optional skill (required: false)
    const optionalDir = path.join(root, "skills", "dealdesk-dev");
    await fs.mkdir(optionalDir, { recursive: true });
    await fs.writeFile(path.join(optionalDir, "SKILL.md"), "---\nname: dealdesk-dev\nrequired: false\n---\n\n# Dev\n");

    const entries = await listDealDeskSkillEntries(moduleDir);
    entries.sort((a, b) => a.runtimeName.localeCompare(b.runtimeName));

    expect(entries).toHaveLength(2);
    expect(entries[0]?.runtimeName).toBe("dealdesk");
    expect(entries[0]?.required).toBe(true);
    expect(entries[1]?.runtimeName).toBe("dealdesk-dev");
    expect(entries[1]?.required).toBe(false);
    expect(entries[1]?.requiredReason).toBeNull();
  });

  it("removes stale maintainer-only symlinks from a shared skills home", async () => {
    const root = await makeTempDir("dealdesk-skill-cleanup-");
    cleanupDirs.add(root);

    const skillsHome = path.join(root, "skills-home");
    const runtimeSkill = path.join(root, "skills", "dealdesk");
    const customSkill = path.join(root, "custom", "release-notes");
    const staleMaintainerSkill = path.join(root, ".agents", "skills", "release");

    await fs.mkdir(skillsHome, { recursive: true });
    await fs.mkdir(runtimeSkill, { recursive: true });
    await fs.mkdir(customSkill, { recursive: true });

    await fs.symlink(runtimeSkill, path.join(skillsHome, "dealdesk"));
    await fs.symlink(customSkill, path.join(skillsHome, "release-notes"));
    await fs.symlink(staleMaintainerSkill, path.join(skillsHome, "release"));

    const removed = await removeMaintainerOnlySkillSymlinks(skillsHome, ["dealdesk"]);

    expect(removed).toEqual(["release"]);
    await expect(fs.lstat(path.join(skillsHome, "release"))).rejects.toThrow();
    expect((await fs.lstat(path.join(skillsHome, "dealdesk"))).isSymbolicLink()).toBe(true);
    expect((await fs.lstat(path.join(skillsHome, "release-notes"))).isSymbolicLink()).toBe(true);
  });
});
