import type { UIAdapterModule } from "../types";
import { parseOpenCodeStdoutLine } from "@dealdesk/adapter-opencode-local/ui";
import { OpenCodeLocalConfigFields } from "./config-fields";
import { buildOpenCodeLocalConfig } from "@dealdesk/adapter-opencode-local/ui";

export const openCodeLocalUIAdapter: UIAdapterModule = {
  type: "opencode_local",
  label: "OpenCode (local)",
  parseStdoutLine: parseOpenCodeStdoutLine,
  ConfigFields: OpenCodeLocalConfigFields,
  buildAdapterConfig: buildOpenCodeLocalConfig,
};
