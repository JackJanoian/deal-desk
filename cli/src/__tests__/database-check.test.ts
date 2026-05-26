import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { databaseCheck } from "../checks/database-check.js";
import type { DealDeskConfig } from "../config/schema.js";

const { createDbMock, getPostgresDataDirectoryMock } = vi.hoisted(() => ({
  createDbMock: vi.fn(),
  getPostgresDataDirectoryMock: vi.fn(),
}));

vi.mock("@dealdesk/db", () => ({
  createDb: createDbMock,
  getPostgresDataDirectory: getPostgresDataDirectoryMock,
}));

function createConfig(overrides: Partial<DealDeskConfig["database"]> = {}): DealDeskConfig {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dealdesk-database-check-"));
  return {
    $meta: {
      version: 1,
      updatedAt: "2026-03-10T00:00:00.000Z",
      source: "configure",
    },
    database: {
      mode: "embedded-postgres",
      embeddedPostgresDataDir: path.join(root, "db"),
      embeddedPostgresPort: 55432,
      backup: {
        enabled: true,
        intervalMinutes: 60,
        retentionDays: 30,
        dir: path.join(root, "backups"),
      },
      ...overrides,
    },
    logging: {
      mode: "file",
      logDir: path.join(root, "logs"),
    },
    server: {
      deploymentMode: "local_trusted",
      exposure: "private",
      host: "127.0.0.1",
      port: 3199,
      allowedHostnames: [],
      serveUi: true,
    },
    auth: {
      baseUrlMode: "auto",
      disableSignUp: false,
    },
    telemetry: {
      enabled: true,
    },
    storage: {
      provider: "local_disk",
      localDisk: {
        baseDir: path.join(root, "storage"),
      },
      s3: {
        bucket: "dealdesk",
        region: "us-east-1",
        prefix: "",
        forcePathStyle: false,
      },
    },
    secrets: {
      provider: "local_encrypted",
      strictMode: false,
      localEncrypted: {
        keyFilePath: path.join(root, "secrets", "master.key"),
      },
    },
  };
}

describe("databaseCheck", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("warns when embedded PostgreSQL is configured but not currently reachable", async () => {
    const db = {
      execute: vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:55432")),
      $client: { end: vi.fn(async () => undefined) },
    };
    createDbMock.mockReturnValue(db);
    getPostgresDataDirectoryMock.mockResolvedValue(null);

    const result = await databaseCheck(createConfig());

    expect(result).toMatchObject({
      name: "Database",
      status: "warn",
    });
    expect(result.message).toContain("not currently reachable");
    expect(db.$client.end).toHaveBeenCalledWith({ timeout: 5 });
  });

  it("fails when embedded PostgreSQL port points at a different data directory", async () => {
    const config = createConfig();
    const db = {
      execute: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
      $client: { end: vi.fn(async () => undefined) },
    };
    createDbMock.mockReturnValue(db);
    getPostgresDataDirectoryMock.mockResolvedValue(path.join(os.tmpdir(), "other-db"));

    const result = await databaseCheck(config);

    expect(result).toMatchObject({
      name: "Database",
      status: "fail",
      canRepair: false,
    });
    expect(result.message).toContain("different data directory");
  });
});
