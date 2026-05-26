import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { HOME_DIR, LEGACY_HOME_DIR } from "@dealdesk/shared/branding";
import type { CheckResult } from "../checks/index.js";

export function legacyHomeMigrationCheck(): CheckResult {
  const home = os.homedir();
  const legacy = path.resolve(home, LEGACY_HOME_DIR);
  const preferred = path.resolve(home, HOME_DIR);

  if (!fs.existsSync(legacy)) {
    return {
      name: "Legacy config migration",
      status: "pass",
      message: `Config home: ${preferred}`,
      canRepair: false,
    };
  }

  if (fs.existsSync(preferred)) {
    return {
      name: "Legacy config migration",
      status: "warn",
      message: `Both ${legacy} and ${preferred} exist. Prefer ${preferred}.`,
      canRepair: false,
      repairHint: `Archive or remove ${legacy} after confirming ${preferred} has your data.`,
    };
  }

  return {
    name: "Legacy config migration",
    status: "warn",
    message: `Legacy config found at ${legacy}. Migrate to ${preferred}.`,
    canRepair: true,
    repairHint: `Run: cp -R "${legacy}" "${preferred}"`,
  };
}

export async function repairLegacyHomeMigration(): Promise<void> {
  const home = os.homedir();
  const legacy = path.resolve(home, LEGACY_HOME_DIR);
  const preferred = path.resolve(home, HOME_DIR);
  if (!fs.existsSync(legacy) || fs.existsSync(preferred)) return;
  fs.cpSync(legacy, preferred, { recursive: true });
}
