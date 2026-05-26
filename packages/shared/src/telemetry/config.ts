import type { TelemetryConfig } from "./types.js";

const CI_ENV_VARS = ["CI", "CONTINUOUS_INTEGRATION", "BUILD_NUMBER", "GITHUB_ACTIONS", "GITLAB_CI"];

function isCI(): boolean {
  return CI_ENV_VARS.some((key) => process.env[key] === "true" || process.env[key] === "1");
}

export function resolveTelemetryConfig(fileConfig?: { enabled?: boolean }): TelemetryConfig {
  // Explicit opt-outs always win.
  if (process.env.DEALDESK_TELEMETRY_DISABLED === "1") {
    return { enabled: false };
  }
  if (process.env.DO_NOT_TRACK === "1") {
    return { enabled: false };
  }
  if (isCI()) {
    return { enabled: false };
  }
  if (fileConfig?.enabled === false) {
    return { enabled: false };
  }

  // Telemetry is opt-in: it stays off unless the user explicitly turns it on,
  // either in their config file (telemetry.enabled: true) or via the
  // DEALDESK_TELEMETRY_ENABLED=1 environment variable. This keeps Deal Desk
  // local-first by default — no usage data leaves the machine unless asked.
  const explicitlyEnabled =
    fileConfig?.enabled === true || process.env.DEALDESK_TELEMETRY_ENABLED === "1";
  if (!explicitlyEnabled) {
    return { enabled: false };
  }

  const endpoint = process.env.DEALDESK_TELEMETRY_ENDPOINT || undefined;
  return { enabled: true, endpoint };
}
