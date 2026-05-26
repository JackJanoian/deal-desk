import { describe, expect, it, vi } from "vitest";
import { createCoalescedErrorLogger } from "../utils/coalesced-error-logger.js";

describe("createCoalescedErrorLogger", () => {
  it("logs the first repeated error immediately and then coalesces within the interval", () => {
    const logger = {
      error: vi.fn(),
    };
    const clock = vi.fn()
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_500)
      .mockReturnValueOnce(62_000);
    const log = createCoalescedErrorLogger({
      logger,
      intervalMs: 60_000,
      now: clock,
    });

    log(new Error("connect ECONNREFUSED"), "heartbeat timer tick failed");
    log(new Error("connect ECONNREFUSED"), "heartbeat timer tick failed");
    log(new Error("connect ECONNREFUSED"), "heartbeat timer tick failed");

    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenNthCalledWith(
      1,
      { err: expect.any(Error) },
      "heartbeat timer tick failed",
    );
    expect(logger.error).toHaveBeenNthCalledWith(
      2,
      { err: expect.any(Error), suppressedCount: 1 },
      "heartbeat timer tick failed",
    );
  });
});
