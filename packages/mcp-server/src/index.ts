import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DealDeskApiClient } from "./client.js";
import { readConfigFromEnv, type DealDeskMcpConfig } from "./config.js";
import { createToolDefinitions } from "./tools.js";

export function createDealDeskMcpServer(config: DealDeskMcpConfig = readConfigFromEnv()) {
  const server = new McpServer({
    name: "dealdesk",
    version: "0.1.0",
  });

  const client = new DealDeskApiClient(config);
  const tools = createToolDefinitions(client);
  for (const tool of tools) {
    server.tool(tool.name, tool.description, tool.schema.shape, tool.execute);
  }

  return {
    server,
    tools,
    client,
  };
}

export async function runServer(config: DealDeskMcpConfig = readConfigFromEnv()) {
  const { server } = createDealDeskMcpServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
