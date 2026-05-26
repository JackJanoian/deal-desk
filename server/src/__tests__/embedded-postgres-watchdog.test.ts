import { afterEach, describe, expect, it, vi } from "vitest";
import { startEmbeddedPostgresLivenessWatchdog } from "../embedded-postgres-watchdog.js";

describe("startEmbeddedPostgresLivenessWatchdog", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("exits the server when an embedded PostgreSQL probe fails after startup", async () => {
    vi.useFakeTimers();
    const logger = {
      error: vi.fn(),
    };
    const dispose = startEmbeddedPostgresLivenessWatchdog({
      probe: vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED")),
      logger,
      exit: vi.fn() as never,
      intervalMs: 1_000,
    });

    await vi.advanceTimersByTimeAsync(1_000);

    expect(logger.error).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      "Embedded PostgreSQL became unreachable; exiting DealDesk server",
    );
    dispose();
  });
});
