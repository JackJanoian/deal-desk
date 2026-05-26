#!/usr/bin/env node
/** Second-pass rebrand — lowercase wire-format identifiers missed by first pass. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "data", "releases"]);

const REPLACEMENTS = [
  ["paperclipWake", "dealDeskWake"],
  ["paperclipWorkspaces", "dealDeskWorkspaces"],
  ["paperclipWorkspace", "dealDeskWorkspace"],
  ["paperclipSessionHandoffMarkdown", "dealDeskSessionHandoffMarkdown"],
  ["paperclipBridge", "dealDeskBridge"],
  ["paperclipEnvNote", "dealDeskEnvNote"],
  ["paperclipApiUrl", "dealDeskApiUrl"],
  ["paperclipExtensionPath", "dealDeskExtensionPath"],
  ["paperclip_required", "dealdesk_required"],
  ['type: "paperclip"', 'type: "dealdesk"'],
  ['"paperclip"', '"dealdesk"'],
  ["paperclip_run_events", "dealdesk_run_events"],
  ["paperclip_run_log", "dealdesk_run_log"],
  ["paperclip_run", "dealdesk_run"],
  ["paperclipRun", "dealDeskRun"],
  ["paperclip-feedback", "dealdesk-feedback"],
  ["paperclip-distill", "dealdesk-distill"],
  ["paperclip-file-browser", "dealdesk-file-browser"],
  ["paperclip-get-issue", "dealdesk-get-issue"],
  ["paperclipData", "dealDeskData"],
  ["paperclip-ingest", "dealdesk-ingest"],
  ["x-paperclip-run-id", "x-dealdesk-run-id"],
  ["x-paperclip-dev-server-status-token", "x-dealdesk-dev-server-status-token"],
  ["x-paperclip-signature", "x-dealdesk-signature"],
  ["postgres://paperclip:paperclip@", "postgres://dealdesk:dealdesk@"],
  ['"/paperclip"', '"/dealdesk"'],
  ["user: \"paperclip\"", "user: \"dealdesk\""],
  ['password: "paperclip"', 'password: "dealdesk"'],
  ["filenamePrefix: \"paperclip\"", "filenamePrefix: \"dealdesk\""],
  ['filenamePrefix ?? "paperclip"', 'filenamePrefix ?? "dealdesk"'],
  ["paperclip-env", "dealdesk-env"],
  ["paperclip statement breakpoint", "dealdesk statement breakpoint"],
  ["$paperclip$", "$dealdesk$"],
  ["paperclip_", "dealdesk_"],
  [" paperclip ", " dealdesk "],
  [" paperclip doctor ", " dealdesk doctor "],
  [" paperclip onboard ", " dealdesk onboard "],
  [" paperclip run ", " dealdesk run "],
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
  if (file.includes("rebrand-codemod") || file.includes("rebrand-pass2")) continue;
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
console.log(`Pass 2 updated ${changed} files.`);
