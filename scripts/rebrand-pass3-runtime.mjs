#!/usr/bin/env node
/** Third-pass rebrand — runtime wire identifiers and test fixtures. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "data", "releases", ".agents"]);

const SKIP_FILE = (rel) =>
  rel.includes("rebrand-pass") ||
  rel.includes("rebrand-codemod") ||
  rel.includes("check-paperclip-rebrand") ||
  rel.includes("DEALDESK_MIGRATION_SHIM") ||
  rel.includes("FORK.md") ||
  rel.includes("FORK_REPORT.md") ||
  rel.includes("pnpm-lock.yaml") ||
  rel.includes("0090_dealdesk_rebrand.sql");

/** Most specific first. */
const REPLACEMENTS = [
  ["paperclipContinuationSummary", "dealDeskContinuationSummary"],
  ["paperclipSessionRotationReason", "dealDeskSessionRotationReason"],
  ["paperclipPreviousSessionId", "dealDeskPreviousSessionId"],
  ["paperclipTaskMarkdown", "dealDeskTaskMarkdown"],
  ["paperclipModelProfile", "dealDeskModelProfile"],
  ["paperclipHarnessCheckedOut", "dealDeskHarnessCheckedOut"],
  ["paperclipManagedResource", "dealdeskManagedResource"],
  ["paperclipSkillSync", "dealdeskSkillSync"],
  ["paperclipSkillKey", "dealDeskSkillKey"],
  ["paperclipEnvironment", "dealDeskEnvironment"],
  ["paperclipSecrets", "dealDeskSecrets"],
  ["paperclipIssue", "dealDeskIssue"],
  ["dealdesk/dealdesk/paperclip", "dealdesk/dealdesk/dealdesk"],
  ["/skills/paperclip", "/skills/dealdesk"],
  ["skills/paperclip", "skills/dealdesk"],
  ["~/.openclaw/skills/paperclip/", "~/.openclaw/skills/dealdesk/"],
  ["~/.openclaw/skills/paperclip", "~/.openclaw/skills/dealdesk"],
  ["~/.openclaw/workspace/paperclip-claimed-api-key.json", "~/.openclaw/workspace/dealdesk-claimed-api-key.json"],
  ["paperclip-claimed-api-key.json", "dealdesk-claimed-api-key.json"],
  [".paperclip-bridge-upload.lock", ".dealdesk-bridge-upload.lock"],
  [".paperclip-bridge-upload", ".dealdesk-bridge-upload"],
  ["paperclip-bridge-server.mjs", "dealdesk-bridge-server.mjs"],
  [".paperclip-write.lock", ".dealdesk-write.lock"],
  [".paperclip-upload.b64", ".dealdesk-upload.b64"],
  [".paperclip-materialized-skill.json", ".dealdesk-materialized-skill.json"],
  [".paperclip-restore.lock", ".dealdesk-restore.lock"],
  [".paperclip-provision-", ".dealdesk-provision-"],
  [".paperclip-restored-", ".dealdesk-restored-"],
  [".paperclip-runtime", ".dealdesk-runtime"],
  ["paperclip-bridge", "dealdesk-bridge"],
  ["paperclipSkillsDir", "dealDeskSkillsDir"],
  ["paperclipSkillNames", "dealDeskSkillNames"],
  ["paperclipSkillName", "dealDeskSkillName"],
  ["paperclipKey", "dealdeskKey"],
  ["paperclipEnvKeys", "dealDeskEnvKeys"],
  ["paperclipEnvNote", "dealDeskEnvNote"],
  ["paperclipEnv:", "dealDeskEnv:"],
  ["paperclipEnv ", "dealDeskEnv "],
  ["paperclipEnv=", "dealDeskEnv="],
  ["paperclipPayload", "dealDeskPayload"],
  ["paperclipData", "dealDeskData"],
  ["paperclipConfig:", "dealDeskConfig:"],
  ["paperclipHome:", "dealDeskHome:"],
  ["paperclipInstanceId:", "dealDeskInstanceId:"],
  ["paperclipHome ", "dealDeskHome "],
  ["paperclipHome=", "dealDeskHome="],
  ["paperclipHome)", "dealDeskHome)"],
  ["paperclipInstanceId", "dealDeskInstanceId"],
  ["paperclipHome", "dealDeskHome"],
  ["paperclipExtension", "dealDeskExtension"],
  ["paperclipAgentsOut", "dealDeskAgentsOut"],
  ["paperclipProjectsOut", "dealDeskProjectsOut"],
  ["paperclipTasksOut", "dealDeskTasksOut"],
  ["paperclipRoutinesOut", "dealDeskRoutinesOut"],
  ["paperclipCompany", "dealDeskCompany"],
  ["paperclipSidebar", "dealDeskSidebar"],
  ["paperclipAgents", "dealDeskAgents"],
  ["paperclipProjects", "dealDeskProjects"],
  ["paperclipTasks", "dealDeskTasks"],
  ["paperclipRoutines", "dealDeskRoutines"],
  ["paperclipIngestionStateBadge", "dealDeskIngestionStateBadge"],
  ["paperclipIssue(", "dealDeskIssue("],
  ["x-paperclip-timestamp", "x-dealdesk-timestamp"],
  ["paperclip_required", "dealdesk_required"],
  ["paperclip.local", "dealdesk.local"],
  ["paperclip@example.com", "dealdesk@example.com"],
  ["local@paperclip.local", "local@dealdesk.local"],
  ["paperclip-hostname", "dealdesk-hostname"],
  ["distill-paperclip-now", "distill-dealdesk-now"],
  ["assemble-paperclip-source-bundle", "assemble-dealdesk-source-bundle"],
  ["distill-paperclip-project-page", "distill-dealdesk-project-page"],
  ["paperclipWikiSidebarTreePath", "dealDeskWikiSidebarTreePath"],
  ["paperclip:llm-wiki-history-issues-view", "dealdesk:llm-wiki-history-issues-view"],
  ["NPM_PLUGIN_PACKAGE_PREFIX = \"paperclip-plugin-\"", "NPM_PLUGIN_PACKAGE_PREFIX = \"dealdesk-plugin-\""],
  ["paperclip-plugin-", "dealdesk-plugin-"],
  ["paperclip.fake-sandbox-provider", "dealdesk.fake-sandbox-provider"],
  ["paperclip.daytona-sandbox-provider", "dealdesk.daytona-sandbox-provider"],
  ["paperclip-workspace", "dealdesk-workspace"],
  ["paperclip-worktrees", "dealdesk-worktrees"],
  ["paperclip-worktree-", "dealdesk-worktree-"],
  ["paperclip-complete", "dealdesk-complete"],
  ["paperclip:run:", "dealdesk:run:"],
  ["paperclip:issue:", "dealdesk:issue:"],
  ["paperclip:session:", "dealdesk:session:"],
  ["paperclip truncated run log", "dealdesk truncated run log"],
  ["paperclip on board", "dealdesk on board"],
  ["paperclip onboard", "dealdesk onboard"],
  ["Run paperclip onboard", "Run dealdesk onboard"],
  ["paperclip doctor", "dealdesk doctor"],
  ["paperclip run ", "dealdesk run "],
  ["paperclip run.", "dealdesk run."],
  ["agentParams.paperclip", "agentParams.dealDesk"],
  ["templateDealDesk.paperclip", "templateDealDesk.dealDesk"],
  ["payloadTemplate.paperclip", "payloadTemplate.dealDesk"],
  [".paperclip-local-folder-probe-", ".dealdesk-local-folder-probe-"],
  [".paperclip-${", ".dealdesk-${"],
  [".paperclip-sdk", ".dealdesk-sdk"],
  [".paperclip-lease.json", ".dealdesk-lease.json"],
  ["/api/paperclip-sandbox/", "/api/dealdesk-sandbox/"],
  ["refs/paperclip/", "refs/dealdesk/"],
  ["paperclip-ssh-", "dealdesk-ssh-"],
  ["paperclip-sandbox-", "dealdesk-sandbox-"],
  ["paperclip-command-runtime", "dealdesk-command-runtime"],
  ["paperclip-bridge-", "dealdesk-bridge-"],
  ["paperclip-storage-", "dealdesk-storage-"],
  ["paperclip-acpx-", "dealdesk-acpx-"],
  ["paperclip-claude-", "dealdesk-claude-"],
  ["paperclip-codex-", "dealdesk-codex-"],
  ["paperclip-cursor-", "dealdesk-cursor-"],
  ["paperclip-gemini-", "dealdesk-gemini-"],
  ["paperclip-opencode-", "dealdesk-opencode-"],
  ["paperclip-pi-", "dealdesk-pi-"],
  ["paperclip-runtime-", "dealdesk-runtime-"],
  ["paperclip-worktree-", "dealdesk-worktree-"],
  ["paperclip-secrets-", "dealdesk-secrets-"],
  ["paperclip-routines-", "dealdesk-routines-"],
  ["paperclip-heartbeat-", "dealdesk-heartbeat-"],
  ["paperclip-plugin-", "dealdesk-plugin-"],
  ["paperclip-company-", "dealdesk-company-"],
  ["paperclip-cli-", "dealdesk-cli-"],
  ["paperclip-onboard-", "dealdesk-onboard-"],
  ["paperclip-doctor-", "dealdesk-doctor-"],
  ["paperclip-jwt-env-", "dealdesk-jwt-env-"],
  ["paperclip-allowed-hostname-", "dealdesk-allowed-hostname-"],
  ["paperclip-db-client-", "dealdesk-db-client-"],
  ["paperclip-deal-desk-", "dealdesk-deal-desk-"],
  ["paperclip-access-service-", "dealdesk-access-service-"],
  ["paperclip-costs-service-", "dealdesk-costs-service-"],
  ["paperclip-skill-", "dealdesk-skill-"],
  ["paperclip-distill", "dealdesk-distill"],
  ["paperclip-bench", "dealdesk-bench"],
  ["paperclip-demo", "dealdesk-demo"],
  ["paperclip-prod", "dealdesk-prod"],
  ["paperclip-prod1", "dealdesk-prod1"],
  ["paperclip-password", "dealdesk-password"],
  ["paperclip-pr-", "dealdesk-pr-"],
  ["paperclip/pr-", "dealdesk/pr-"],
  ["paperclip-make-test", "dealdesk-make-test"],
  ["paperclip-ing", "dealdesk.ing"],
  ["telemetry.paperclip.ing", "telemetry.dealdesk.ing"],
  ["https://paperclip.ing", "https://dealdesk.ing"],
  ["https://paperclip.test", "https://dealdesk.test"],
  ["https://paperclip.example", "https://dealdesk.example"],
  ["paperclip.invalid", "dealdesk.invalid"],
  ["paperclip-ing", "dealdesk-ing"],
  ["paperclip@example", "dealdesk@example"],
  ["@paperclip/plugin-", "@dealdesk/plugin-"],
  ["paperclip.hello-world-example", "dealdesk.hello-world-example"],
  ["paperclip-kitchen-sink-example", "dealdesk-kitchen-sink-example"],
  ["paperclip.claude-usage", "dealdesk.claude-usage"],
  ["paperclip.missions", "dealdesk.missions"],
  ["paperclip.local-folders", "dealdesk.local-folders"],
  ["paperclip.managed-skills-test", "dealdesk.managed-skills-test"],
  ["paperclip-managed-skills-test", "dealdesk-managed-skills-test"],
  ["paperclip.test-managed-skills", "dealdesk.test-managed-skills"],
  ["paperclip-app", "dealdesk-app"],
  ["paperclip-fake-sandbox-", "dealdesk-fake-sandbox-"],
  ["paperclip-exe-dev-", "dealdesk-exe-dev-"],
  ["paperclip-adapter-routes-test", "dealdesk-adapter-routes-test"],
  ["paperclip-adapter-plugins", "dealdesk-adapter-plugins"],
  ["droid-paperclip-adapter", "droid-dealdesk-adapter"],
  ["my-paperclip-adapter", "my-dealdesk-adapter"],
  ["paperclipConfigSchema", "dealDeskConfigSchema"],
  ['describe("paperclip config schema"', 'describe("dealdesk config schema"'],
  ["paperclip-claude-prompt-bundle", "dealdesk-claude-prompt-bundle"],
  ["paperclip-probe", "dealdesk-probe"],
  ["version: \"paperclip-probe\"", "version: \"dealdesk-probe\""],
  ["path: \"paperclip/", "path: \"dealdesk/"],
  ["paperclip/run.json", "dealdesk/run.json"],
  ["paperclip/run-events.json", "dealdesk/run-events.json"],
  ["paperclip/run-log.ndjson", "dealdesk/run-log.ndjson"],
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs|json|md|html|css|yml|yaml|sh|sql|svg)$/.test(full) || path.basename(full) === "Dockerfile") {
      files.push(full);
    }
  }
  return files;
}

let changed = 0;
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file);
  if (SKIP_FILE(rel)) continue;
  const original = fs.readFileSync(file, "utf8");
  let updated = original;
  for (const [from, to] of REPLACEMENTS) {
    updated = updated.split(from).join(to);
  }
  if (updated !== original) {
    fs.writeFileSync(file, updated, "utf8");
    changed++;
  }
}

console.log(`Pass 3 updated ${changed} files.`);
