#!/usr/bin/env node
/**
 * DealDesk full rebrand codemod — idempotent string replacements.
 * Usage: node scripts/rebrand-codemod.mjs [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DRY_RUN = process.argv.includes("--dry-run");

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "data",
  ".pnpm-store",
  "pglite",
]);

const SKIP_FILE_PATTERNS = [
  /pnpm-lock\.yaml$/,
  /rebrand-codemod\.mjs$/,
  /DEALDESK_MIGRATION_SHIM\.md$/,
];

/** Ordered replacements — most specific first. */
const REPLACEMENTS = [
  ["@paperclipai/", "@dealdesk/"],
  ["X-Paperclip-Dev-Server-Status-Token", "X-DealDesk-Dev-Server-Status-Token"],
  ["X-Paperclip-Run-Id", "X-DealDesk-Run-Id"],
  ["X-Paperclip-Signature", "X-DealDesk-Signature"],
  ["PaperclipPluginManifestV1", "DealDeskPluginManifestV1"],
  ["paperclipPluginManifestV1", "dealDeskPluginManifestV1"],
  ["paperclipPlugin", "dealDeskPlugin"],
  ["paperclip_managed", "dealdesk_managed"],
  ["paperclipCompanyId", "dealDeskCompanyId"],
  ["paperclip_company_id", "deal_desk_company_id"],
  ["printPaperclipCliBanner", "printDealDeskCliBanner"],
  ["PAPERCLIP_ASCII_ART", "DEALDESK_ASCII_ART"],
  ["PAPERCLIP_ART", "DEALDESK_ASCII_ART"],
  ["resolvePaperclipHomeDir", "resolveDealDeskHomeDir"],
  ["resolvePaperclipInstanceId", "resolveDealDeskInstanceId"],
  ["resolvePaperclipInstanceRoot", "resolveDealDeskInstanceRoot"],
  ["resolvePaperclipInstanceConfigPath", "resolveDealDeskInstanceConfigPath"],
  ["resolvePaperclipConfigPathForInstance", "resolveDealDeskConfigPathForInstance"],
  ["resolvePaperclipEnvPathForConfig", "resolveDealDeskEnvPathForConfig"],
  ["DEFAULT_PAPERCLIP_INSTANCE_ID", "DEFAULT_DEALDESK_INSTANCE_ID"],
  ["PAPERCLIP_CONFIG_BASENAME", "DEALDESK_CONFIG_BASENAME"],
  ["PAPERCLIP_ENV_FILENAME", "DEALDESK_ENV_FILENAME"],
  ["PAPERCLIP_RUNTIME_BRANDING", "DEALDESK_RUNTIME_BRANDING"],
  ["PAPERCLIP_FAVICON", "DEALDESK_FAVICON"],
  ["PAPERCLIP_HOME", "DEALDESK_HOME"],
  ["PAPERCLIP_INSTANCE_ID", "DEALDESK_INSTANCE_ID"],
  ["PAPERCLIP_IN_WORKTREE", "DEALDESK_IN_WORKTREE"],
  ["PAPERCLIP_WORKTREE", "DEALDESK_WORKTREE"],
  ["PAPERCLIP_UI_DEV_MIDDLEWARE", "DEALDESK_UI_DEV_MIDDLEWARE"],
  ["PAPERCLIP_RUN_ID", "DEALDESK_RUN_ID"],
  ["PAPERCLIP_AGENT_JWT_SECRET", "DEALDESK_AGENT_JWT_SECRET"],
  ["paperclipConfigSchema", "dealDeskConfigSchema"],
  ["PaperclipConfig", "DealDeskConfig"],
  ["usePaperclipIssueRuntime", "useDealDeskIssueRuntime"],
  ["PaperclipSprite", "DealDeskSprite"],
  ["create-paperclip-plugin", "create-dealdesk-plugin"],
  ["create-paperclip-distillation", "create-dealdesk-distillation"],
  ["paperclip-mcp-server", "dealdesk-mcp-server"],
  ["paperclip-plugin-dev-server", "dealdesk-plugin-dev-server"],
  ["paperclip-plugin-fake-sandbox", "dealdesk-plugin-fake-sandbox"],
  ["paperclip-v2", "dealdesk-v2"],
  ["~/.paperclip", "~/.dealdesk"],
  [".paperclip/", ".dealdesk/"],
  ['".paperclip"', '".dealdesk"'],
  ["'/.paperclip'", "'/.dealdesk'"],
  ["paperclipai", "dealdesk"],
  ["paperclip-commit-metrics", "dealdesk-commit-metrics"],
  ["paperclip-issue-update", "dealdesk-issue-update"],
  ["[paperclip]", "[dealdesk]"],
  ["paperclip-worktree-name", "dealdesk-worktree-name"],
  ["paperclip-worktree-color", "dealdesk-worktree-color"],
  ["paperclip.theme", "dealdesk.theme"],
  ["paperclip.selectedCompanyId", "dealdesk.selectedCompanyId"],
  ["paperclip.lastInstanceSettingsPath", "dealdesk.lastInstanceSettingsPath"],
  ["paperclip:issue-document-folds:", "dealdesk:issue-document-folds:"],
  ["paperclip-mention-chip", "dealdesk-mention-chip"],
  ["paperclip-edit-in-place", "dealdesk-edit-in-place"],
  ["what-is-paperclip", "what-is-dealdesk"],
  ["PAPERCLIP", "DEALDESK"],
  ["Paperclip", "DealDesk"],
];

const EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".json", ".md", ".html", ".css", ".yml", ".yaml",
  ".sh", ".sql", ".env", ".example", ".svg",
]);

function shouldProcess(filePath) {
  if (SKIP_FILE_PATTERNS.some((re) => re.test(filePath))) return false;
  const ext = path.extname(filePath);
  const base = path.basename(filePath);
  if (EXTENSIONS.has(ext)) return true;
  if (base === "Dockerfile" || base === ".dockerignore" || base === "LICENSE") return true;
  if (base.startsWith(".env")) return true;
  return false;
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (shouldProcess(full)) files.push(full);
  }
  return files;
}

function applyReplacements(content) {
  let result = content;
  for (const [from, to] of REPLACEMENTS) {
    result = result.split(from).join(to);
  }
  return result;
}

let changedFiles = 0;
let totalReplacements = 0;

for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file);
  const original = fs.readFileSync(file, "utf8");
  const updated = applyReplacements(original);
  if (updated !== original) {
    changedFiles++;
    totalReplacements++;
    if (!DRY_RUN) fs.writeFileSync(file, updated, "utf8");
    console.log(`${DRY_RUN ? "[dry-run] " : ""}updated: ${rel}`);
  }
}

console.log(`\n${DRY_RUN ? "Would update" : "Updated"} ${changedFiles} files.`);
