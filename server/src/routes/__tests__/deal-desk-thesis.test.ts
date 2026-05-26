import { describe, it, expect } from "vitest";
import { buildThesisUpdateValues } from "../deal-desk.js";

describe("buildThesisUpdateValues — M3 whitelist", () => {
  it("includes only whitelisted keys from the request body", () => {
    const body = {
      name: "Updated Name",
      sector: "Healthcare",
      narrative: "new narrative",
    };
    const result = buildThesisUpdateValues(body);
    expect(result).toEqual({
      name: "Updated Name",
      sector: "Healthcare",
      narrative: "new narrative",
    });
  });

  it("drops non-allowed keys even if forged onto the body (e.g. dealDeskCompanyId)", () => {
    // Simulate a body that bypassed validate(updateThesisSchema), e.g. if
    // someone removed .strict() in the future or extended the schema with a
    // sensitive column. The helper must still refuse to forward unknown keys.
    const forged = {
      name: "Legit",
      dealDeskCompanyId: "evil-tenant-id",
      createdByUserId: "attacker-user",
      id: "attempted-id-override",
      updatedAt: new Date("2020-01-01"),
    } as unknown as Parameters<typeof buildThesisUpdateValues>[0];

    const result = buildThesisUpdateValues(forged);

    expect(result.name).toBe("Legit");
    expect(result).not.toHaveProperty("dealDeskCompanyId");
    expect(result).not.toHaveProperty("createdByUserId");
    expect(result).not.toHaveProperty("id");
    expect(result).not.toHaveProperty("updatedAt");
  });

  it("skips undefined values so partial updates do not blank columns", () => {
    const body = {
      name: "Only Name",
      sector: undefined,
      narrative: undefined,
    };
    const result = buildThesisUpdateValues(body);
    expect(result).toEqual({ name: "Only Name" });
  });

  it("preserves explicit null values for nullable columns", () => {
    const body = {
      narrative: null,
      exclusionCriteria: null,
    };
    const result = buildThesisUpdateValues(body);
    expect(result).toEqual({ narrative: null, exclusionCriteria: null });
  });
});
