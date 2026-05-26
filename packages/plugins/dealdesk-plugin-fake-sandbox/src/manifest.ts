import type { DealDeskPluginManifestV1 } from "@dealdesk/plugin-sdk";

const PLUGIN_ID = "dealdesk.fake-sandbox-provider";
const PLUGIN_VERSION = "0.1.0";

const manifest: DealDeskPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "Fake Sandbox Provider",
  description:
    "First-party deterministic sandbox provider plugin for exercising DealDesk provider-plugin integration without external infrastructure.",
  author: "DealDesk",
  categories: ["automation"],
  capabilities: ["environment.drivers.register"],
  entrypoints: {
    worker: "./dist/worker.js",
  },
  environmentDrivers: [
    {
      driverKey: "fake-plugin",
      kind: "sandbox_provider",
      displayName: "Fake Sandbox Provider",
      description:
        "Runs commands in an isolated local temporary directory while exercising the sandbox provider plugin lifecycle.",
      configSchema: {
        type: "object",
        properties: {
          image: {
            type: "string",
            description: "Deterministic fake image label for metadata and matching.",
            default: "fake:latest",
          },
          timeoutMs: {
            type: "number",
            description: "Command timeout in milliseconds.",
            default: 300000,
          },
          reuseLease: {
            type: "boolean",
            description: "Whether to reuse fake leases by environment id.",
            default: false,
          },
        },
      },
    },
  ],
};

export default manifest;
