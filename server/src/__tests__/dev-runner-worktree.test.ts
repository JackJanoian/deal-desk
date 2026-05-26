import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  bootstrapDevRunnerWorktreeEnv,
  isLinkedGitWorktreeCheckout,
  resolveWorktreeEnvFilePath,
} from "../dev-runner-worktree.ts";

const tempRoots = new Set<string>();

afterEach(() => {
  for (const root of tempRoots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  tempRoots.clear();
});

function createTempRoot(prefix: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.add(root);
  return root;
}

describe("dev-runner worktree env bootstrap", () => {
  it("detects linked git worktrees from .git files", () => {
    const root = createTempRoot("dealdesk-dev-runner-worktree-");
    fs.writeFileSync(path.join(root, ".git"), "gitdir: /tmp/dealdesk/.git/worktrees/feature\n", "utf8");

    expect(isLinkedGitWorktreeCheckout(root)).toBe(true);
  });

  it("loads repo-local DealDesk env for initialized worktrees without overriding explicit env", () => {
    const root = createTempRoot("dealdesk-dev-runner-worktree-env-");
    fs.mkdirSync(path.join(root, ".dealdesk"), { recursive: true });
    fs.writeFileSync(path.join(root, ".git"), "gitdir: /tmp/dealdesk/.git/worktrees/feature\n", "utf8");
    fs.writeFileSync(
      resolveWorktreeEnvFilePath(root),
      [
        "DEALDESK_HOME=/tmp/dealdesk-worktrees",
        "DEALDESK_INSTANCE_ID=feature-worktree",
        "DEALDESK_IN_WORKTREE=true",
        "DEALDESK_WORKTREE_NAME=feature-worktree",
        "DEALDESK_OPTIONAL= # comment-only value",
        "",
      ].join("\n"),
      "utf8",
    );

    const env: NodeJS.ProcessEnv = {
      DEALDESK_INSTANCE_ID: "already-set",
    };
    const result = bootstrapDevRunnerWorktreeEnv(root, env);

    expect(result).toEqual({
      envPath: resolveWorktreeEnvFilePath(root),
      missingEnv: false,
    });
    expect(env.DEALDESK_HOME).toBe("/tmp/dealdesk-worktrees");
    expect(env.DEALDESK_INSTANCE_ID).toBe("already-set");
    expect(env.DEALDESK_IN_WORKTREE).toBe("true");
    expect(env.DEALDESK_OPTIONAL).toBe("");
  });

  it("reports uninitialized linked worktrees so dev runner can fail fast", () => {
    const root = createTempRoot("dealdesk-dev-runner-worktree-missing-");
    fs.writeFileSync(path.join(root, ".git"), "gitdir: /tmp/dealdesk/.git/worktrees/feature\n", "utf8");

    expect(bootstrapDevRunnerWorktreeEnv(root, {})).toEqual({
      envPath: resolveWorktreeEnvFilePath(root),
      missingEnv: true,
    });
  });
});
