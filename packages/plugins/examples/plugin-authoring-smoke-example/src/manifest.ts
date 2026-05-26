import type { DealDeskPluginManifestV1 } from "@dealdesk/plugin-sdk";

const manifest: DealDeskPluginManifestV1 = {
  id: "dealdesk.plugin-authoring-smoke-example",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Plugin Authoring Smoke Example",
  description: "A DealDesk plugin",
  author: "Plugin Author",
  categories: ["connector"],
  capabilities: [
    "events.subscribe",
    "plugin.state.read",
    "plugin.state.write",
    "ui.dashboardWidget.register"
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui"
  },
  ui: {
    slots: [
      {
        type: "dashboardWidget",
        id: "health-widget",
        displayName: "Plugin Authoring Smoke Example Health",
        exportName: "DashboardWidget"
      }
    ]
  }
};

export default manifest;
