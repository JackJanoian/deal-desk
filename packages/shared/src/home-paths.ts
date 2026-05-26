import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { HOME_DIR, LEGACY_HOME_DIR } from "./branding.js";

export const DEFAULT_DEALDESK_INSTANCE_ID = "default";
export const DEALDESK_CONFIG_BASENAME = "config.json";
export const DEALDESK_ENV_FILENAME = ".env";

const PATH_SEGMENT_RE = /^[a-zA-Z0-9_-]+$/;

let legacyHomeWarningShown = false;
let legacyEnvWarningShown = false;

export function expandHomePrefix(value: string): string {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.resolve(os.homedir(), value.slice(2));
  return value;
}

function warnLegacyEnv(name: string, replacement: string): void {
  if (legacyEnvWarningShown) return;
  legacyEnvWarningShown = true;
  process.stderr.write(
    `[dealdesk] Warning: ${name} is deprecated. Use ${replacement} instead.\n`,
  );
}

function resolveConfiguredHomeDir(homeOverride?: string): string | null {
  const override = homeOverride?.trim();
  if (override) return path.resolve(expandHomePrefix(override));

  const dealDeskHome = process.env.DEALDESK_HOME?.trim();
  if (dealDeskHome) return path.resolve(expandHomePrefix(dealDeskHome));

  const legacyHome = process.env.PAPERCLIP_HOME?.trim();
  if (legacyHome) {
    warnLegacyEnv("PAPERCLIP_HOME", "DEALDESK_HOME");
    return path.resolve(expandHomePrefix(legacyHome));
  }

  return null;
}

export function resolveDealDeskHomeDir(homeOverride?: string): string {
  const configured = resolveConfiguredHomeDir(homeOverride);
  if (configured) return configured;

  const home = os.homedir();
  const preferred = path.resolve(home, HOME_DIR);
  const legacy = path.resolve(home, LEGACY_HOME_DIR);

  if (fs.existsSync(preferred)) return preferred;
  if (fs.existsSync(legacy)) {
    if (!legacyHomeWarningShown) {
      legacyHomeWarningShown = true;
      process.stderr.write(
        `[dealdesk] Using legacy config directory ${legacy}. Run \`dealdesk doctor\` to migrate to ${preferred}.\n`,
      );
    }
    return legacy;
  }

  return preferred;
}

export function resolveDealDeskInstanceId(instanceIdOverride?: string): string {
  const override = instanceIdOverride?.trim();
  if (override) {
    if (!PATH_SEGMENT_RE.test(override)) {
      throw new Error(`Invalid DEALDESK_INSTANCE_ID '${override}'.`);
    }
    return override;
  }

  const dealDeskId = process.env.DEALDESK_INSTANCE_ID?.trim();
  if (dealDeskId) {
    if (!PATH_SEGMENT_RE.test(dealDeskId)) {
      throw new Error(`Invalid DEALDESK_INSTANCE_ID '${dealDeskId}'.`);
    }
    return dealDeskId;
  }

  const legacyId = process.env.PAPERCLIP_INSTANCE_ID?.trim();
  if (legacyId) {
    warnLegacyEnv("PAPERCLIP_INSTANCE_ID", "DEALDESK_INSTANCE_ID");
    if (!PATH_SEGMENT_RE.test(legacyId)) {
      throw new Error(`Invalid PAPERCLIP_INSTANCE_ID '${legacyId}'.`);
    }
    return legacyId;
  }

  return DEFAULT_DEALDESK_INSTANCE_ID;
}

export function resolveDealDeskInstanceRoot(input: {
  homeDir?: string;
  instanceId?: string;
} = {}): string {
  return path.resolve(resolveDealDeskHomeDir(input.homeDir), "instances", resolveDealDeskInstanceId(input.instanceId));
}

export function resolveDealDeskInstanceConfigPath(input: {
  homeDir?: string;
  instanceId?: string;
} = {}): string {
  return path.resolve(resolveDealDeskInstanceRoot(input), DEALDESK_CONFIG_BASENAME);
}

export function resolveDealDeskConfigPathForInstance(input: {
  homeDir?: string;
  instanceId?: string;
} = {}): string {
  return resolveDealDeskInstanceConfigPath(input);
}

export function resolveDealDeskEnvPathForConfig(configPath: string): string {
  return path.resolve(path.dirname(configPath), DEALDESK_ENV_FILENAME);
}

export function resolveDefaultEmbeddedPostgresDir(input: {
  homeDir?: string;
  instanceId?: string;
} = {}): string {
  return path.resolve(resolveDealDeskInstanceRoot(input), "db");
}

export function resolveDefaultLogsDir(input: {
  homeDir?: string;
  instanceId?: string;
} = {}): string {
  return path.resolve(resolveDealDeskInstanceRoot(input), "logs");
}

export function resolveDefaultSecretsKeyFilePath(input: {
  homeDir?: string;
  instanceId?: string;
} = {}): string {
  return path.resolve(resolveDealDeskInstanceRoot(input), "secrets", "master.key");
}

export function resolveDefaultStorageDir(input: {
  homeDir?: string;
  instanceId?: string;
} = {}): string {
  return path.resolve(resolveDealDeskInstanceRoot(input), "data", "storage");
}

export function resolveDefaultBackupDir(input: {
  homeDir?: string;
  instanceId?: string;
} = {}): string {
  return path.resolve(resolveDealDeskInstanceRoot(input), "data", "backups");
}

export function resolveHomeAwarePath(value: string): string {
  return path.resolve(expandHomePrefix(value));
}

/** @deprecated Use resolveDealDeskHomeDir */
export const resolvePaperclipHomeDir = resolveDealDeskHomeDir;
/** @deprecated Use resolveDealDeskInstanceId */
export const resolvePaperclipInstanceId = resolveDealDeskInstanceId;
/** @deprecated Use resolveDealDeskInstanceRoot */
export const resolvePaperclipInstanceRoot = resolveDealDeskInstanceRoot;
