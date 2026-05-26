import type { UIAdapterModule } from "../types";
import { parseCodexStdoutLine } from "@dealdesk/adapter-codex-local/ui";
import { CodexLocalConfigFields } from "./config-fields";
import { buildCodexLocalConfig } from "@dealdesk/adapter-codex-local/ui";

export const codexLocalUIAdapter: UIAdapterModule = {
  type: "codex_local",
  label: "Codex (local)",
  parseStdoutLine: parseCodexStdoutLine,
  ConfigFields: CodexLocalConfigFields,
  buildAdapterConfig: buildCodexLocalConfig,
};
