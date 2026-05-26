#!/usr/bin/env node
/**
 * CI gate: fail if legacy "Paperclip" branding appears outside allowlisted paths.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "data", "releases", ".agents"]);
const ALLOWLIST = [
  /hermes-dealdesk-adapter/,
  // Real upstream npm packages we depend on (aliased locally as hermes-dealdesk-adapter).
  // Their published names cannot be renamed; pnpm-lock.yaml must record them as-is.
  /hermes-paperclip-adapter/,
  /@paperclipai\//,
  // Boundary normalizer that rewrites the upstream adapter's legacy origin/label.
  /legacy-branding-normalizer/,
  /PAPERCLIP_HOME/,
  /PAPERCLIP_INSTANCE_ID/,
  /dealdesk_required/,
  /x-paperclip-/i,
  /upstream-paperclip/,
  /rebrand-codemod/,
  /rebrand-pass2/,
  /check-legacy-branding/,
  /DEALDESK_MIGRATION_SHIM/,
  /paperclip\.theme/,
  /legacy-home-migration/,
  /0090_dealdesk_rebrand\.sql/,
  /fork:upstream/,
  /\.paperclip\.yaml/,
  /paperclip\/v1/,
  /schema: paperclip/,
  /agentcompanies/,
  /Agent Companies/,
  /github\.com\/dealdesk\/dealdesk/,
  /github\.com\/dealdesk\/dealdesk/,
  /FORK\.md/,
  /FORK_REPORT\.md/,
  /docs\/superpowers\/plans/,
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx|js|jsx|mjs|json|md|html|css|yml|yaml|sh|sql|svg|webmanifest)$/.test(full)) {
      files.push(full);
    }
  }
  return files;
}

const violations = [];
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file);
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split("\n");
  lines.forEach((line, index) => {
    if (!/paperclip|Paperclip|PAPERCLIP/.test(line)) return;
    if (ALLOWLIST.some((re) => re.test(line) || re.test(rel))) return;
    violations.push(`${rel}:${index + 1}: ${line.trim().slice(0, 120)}`);
  });
}

if (violations.length > 0) {
  console.error(`Found ${violations.length} legacy Paperclip reference(s):\n`);
  console.error(violations.slice(0, 50).join("\n"));
  if (violations.length > 50) console.error(`\n... and ${violations.length - 50} more`);
  process.exit(1);
}

console.log("No legacy Paperclip branding found outside allowlist.");
