import { existsSync, readFileSync } from "node:fs";
import { resolveDealDeskConfigPath, resolveDealDeskEnvPath } from "./paths.js";
import { type BindMode, type DeploymentExposure, type DeploymentMode } from "@dealdesk/shared";
import {
  renderTerminalBannerDivider,
  renderTerminalBannerHeader,
  renderTerminalBannerRow,
} from "@dealdesk/shared/terminal-banner";

import { parse as parseEnvFileContents } from "dotenv";

type UiMode = "none" | "static" | "vite-dev";

type ExternalPostgresInfo = {
  mode: "external-postgres";
  connectionString: string;
};

type EmbeddedPostgresInfo = {
  mode: "embedded-postgres";
  dataDir: string;
  port: number;
};

type StartupBannerOptions = {
  bind: BindMode;
  host: string;
  deploymentMode: DeploymentMode;
  deploymentExposure: DeploymentExposure;
  authReady: boolean;
  requestedPort: number;
  listenPort: number;
  uiMode: UiMode;
  db: ExternalPostgresInfo | EmbeddedPostgresInfo;
  migrationSummary: string;
  heartbeatSchedulerEnabled: boolean;
  heartbeatSchedulerIntervalMs: number;
  databaseBackupEnabled: boolean;
  databaseBackupIntervalMinutes: number;
  databaseBackupRetentionDays: number;
  databaseBackupDir: string;
};

function redactConnectionString(raw: string): string {
  try {
    const u = new URL(raw);
    const user = u.username || "user";
    const auth = `${user}:***@`;
    return `${u.protocol}//${auth}${u.host}${u.pathname}`;
  } catch {
    return "<invalid DATABASE_URL>";
  }
}

function resolveAgentJwtSecretStatus(
  envFilePath: string,
): {
  status: "pass" | "warn";
  message: string;
} {
  const envValue = process.env.DEALDESK_AGENT_JWT_SECRET?.trim();
  if (envValue) {
    return {
      status: "pass",
      message: "set",
    };
  }

  if (existsSync(envFilePath)) {
    const parsed = parseEnvFileContents(readFileSync(envFilePath, "utf-8"));
    const fileValue = typeof parsed.DEALDESK_AGENT_JWT_SECRET === "string" ? parsed.DEALDESK_AGENT_JWT_SECRET.trim() : "";
    if (fileValue) {
      return {
        status: "warn",
        message: `found in ${envFilePath} but not loaded`,
      };
    }
  }

  return {
    status: "warn",
    message: "missing (run `pnpm dealdesk onboard`)",
  };
}

export function printStartupBanner(opts: StartupBannerOptions): void {
  const baseHost = opts.host === "0.0.0.0" ? "localhost" : opts.host;
  const baseUrl = `http://${baseHost}:${opts.listenPort}`;
  const apiUrl = `${baseUrl}/api`;
  const uiUrl = opts.uiMode === "none" ? "disabled" : baseUrl;
  const configPath = resolveDealDeskConfigPath();
  const envFilePath = resolveDealDeskEnvPath();
  const agentJwtSecret = resolveAgentJwtSecretStatus(envFilePath);

  const dbMode =
    opts.db.mode === "embedded-postgres" ? "embedded-postgres" : "external-postgres";
  const uiModeLabel =
    opts.uiMode === "vite-dev"
      ? "vite-dev-middleware"
      : opts.uiMode === "static"
        ? "static-ui"
        : "headless-api";

  const portValue =
    opts.requestedPort === opts.listenPort
      ? String(opts.listenPort)
      : `${opts.listenPort} (requested ${opts.requestedPort})`;

  const dbDetails =
    opts.db.mode === "embedded-postgres"
      ? `${opts.db.dataDir} (pg:${opts.db.port})`
      : redactConnectionString(opts.db.connectionString);

  const heartbeat = opts.heartbeatSchedulerEnabled
    ? `enabled (${opts.heartbeatSchedulerIntervalMs}ms)`
    : "disabled";
  const dbBackup = opts.databaseBackupEnabled
    ? `enabled (every ${opts.databaseBackupIntervalMinutes}m, keep ${opts.databaseBackupRetentionDays}d)`
    : "disabled";

  const row = (label: string, value: string) => renderTerminalBannerRow(label, value);

  const lines = [
    ...renderTerminalBannerHeader({ includeTagline: false }),
    renderTerminalBannerDivider(),
    row("Mode", `${dbMode}  |  ${uiModeLabel}`),
    row("Deploy", `${opts.deploymentMode} (${opts.deploymentExposure})`),
    row("Bind", `${opts.bind} (${opts.host})`),
    row("Auth", opts.authReady ? "ready" : "not-ready"),
    row("Server", portValue),
    row("API", `${apiUrl} (health: ${apiUrl}/health)`),
    row("UI", uiUrl),
    row("Database", dbDetails),
    row("Migrations", opts.migrationSummary),
    row("Agent JWT", agentJwtSecret.message),
    row("Heartbeat", heartbeat),
    row("DB Backup", dbBackup),
    row("Backup Dir", opts.databaseBackupDir),
    row("Config", configPath),
    agentJwtSecret.status === "warn" ? renderTerminalBannerDivider() : null,
    renderTerminalBannerDivider(),
    "",
  ];

  console.log(lines.filter((line): line is string => line !== null).join("\n"));
}
