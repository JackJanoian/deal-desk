import { describe, expect, it } from "vitest";
import { dealDeskConfigSchema } from "./config-schema.js";

describe("dealdesk config schema", () => {
  it("defaults omitted runtime paths to legacy instance-root locations", () => {
    const parsed = dealDeskConfigSchema.parse({
      $meta: {
        version: 1,
        updatedAt: "2026-05-10T00:00:00.000Z",
        source: "configure",
      },
      database: {
        mode: "embedded-postgres",
      },
      logging: {
        mode: "file",
      },
      server: {},
    });

    expect(parsed.database.embeddedPostgresDataDir).toBe("~/.dealdesk/instances/default/db");
    expect(parsed.database.backup.dir).toBe("~/.dealdesk/instances/default/data/backups");
    expect(parsed.logging.logDir).toBe("~/.dealdesk/instances/default/logs");
    expect(parsed.storage.localDisk.baseDir).toBe("~/.dealdesk/instances/default/data/storage");
    expect(parsed.secrets.localEncrypted.keyFilePath).toBe("~/.dealdesk/instances/default/secrets/master.key");
  });
});
