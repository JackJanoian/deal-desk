import fs from "node:fs";
import { dealDeskConfigSchema, type DealDeskConfig } from "@dealdesk/shared";
import { resolveDealDeskConfigPath } from "./paths.js";

export function readConfigFile(): DealDeskConfig | null {
  const configPath = resolveDealDeskConfigPath();

  if (!fs.existsSync(configPath)) return null;

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return dealDeskConfigSchema.parse(raw);
  } catch {
    return null;
  }
}
