import { describe, expect, it } from "vitest";
import {
  ACTIVE_PIPELINE_STATUSES,
  CLOSED_PIPELINE_STATUSES,
  daysInStage,
  isStaleInStage,
  statusLabel,
} from "../../components/deal-desk/target-utils";

describe("target-utils", () => {
  it("labels pipeline statuses for display", () => {
    expect(statusLabel("meeting_booked")).toBe("Meeting Booked");
    expect(statusLabel("in_diligence")).toBe("In Diligence");
  });

  it("defines active and closed pipeline columns", () => {
    expect(ACTIVE_PIPELINE_STATUSES).toHaveLength(7);
    expect(CLOSED_PIPELINE_STATUSES).toEqual(["closed_won", "closed_lost"]);
    expect(ACTIVE_PIPELINE_STATUSES).not.toContain("closed_won");
  });

  it("flags stale active-stage targets after threshold", () => {
    const old = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    expect(isStaleInStage("qualified", old, 14)).toBe(true);
    expect(isStaleInStage("closed_won", old, 14)).toBe(false);
  });

  it("computes days in stage", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(daysInStage(threeDaysAgo)).toBe(3);
    expect(daysInStage(null)).toBeNull();
  });
});
