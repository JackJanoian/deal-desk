import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  resolveContactEmail,
  contactNeedsApolloEnrichment,
  loadContactForEnrichment,
} from "../resolve-contact-email.js";

const resolvePersonEmailMock = vi.fn();

describe("resolveContactEmail", () => {
  beforeEach(() => {
    resolvePersonEmailMock.mockReset();
  });

  const contactRow = {
    id: "contact-1",
    dealDeskCompanyId: "co-1",
    firstName: "Alice",
    lastName: "Smith",
    title: "CEO",
    email: null,
    source: null,
    emailStatus: "unverified",
    website: "https://acme.com",
  };

  const db = (): any => ({
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            limit: () => Promise.resolve([contactRow]),
          }),
        }),
      }),
    }),
    update: () => ({ set: vi.fn().mockReturnValue({ where: vi.fn() }) }),
  });

  it("returns apollo_not_configured when no API key", async () => {
    const result = await resolveContactEmail({
      db: db(),
      companyId: "co-1",
      contactId: "contact-1",
      loadApolloKey: async () => null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("apollo_not_configured");
  });

  it("returns success with email from Apollo", async () => {
    resolvePersonEmailMock.mockResolvedValueOnce({
      email: "alice@acme.com",
      emailStatus: "verified",
      apolloPersonId: "p-1",
    });
    const result = await resolveContactEmail({
      db: db(),
      companyId: "co-1",
      contactId: "contact-1",
      loadApolloKey: async () => "key-xyz",
      resolvePersonEmailFn: resolvePersonEmailMock,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.email).toBe("alice@acme.com");
      expect(result.source).toBe("apollo");
    }
  });

  it("maps apollo plan blocked errors", async () => {
    const { ApolloApiError } = await import("../apollo-client.js");
    resolvePersonEmailMock.mockRejectedValueOnce(
      new ApolloApiError(403, '{"error_code":"API_INACCESSIBLE"}'),
    );
    const result = await resolveContactEmail({
      db: db(),
      companyId: "co-1",
      contactId: "contact-1",
      loadApolloKey: async () => "key-xyz",
      resolvePersonEmailFn: resolvePersonEmailMock,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("apollo_plan_blocked");
  });
});

describe("contactNeedsApolloEnrichment", () => {
  it("returns true when email is missing", () => {
    expect(
      contactNeedsApolloEnrichment({ email: null, source: null, emailStatus: "unverified" }),
    ).toBe(true);
  });

  it("returns true when source is not apollo", () => {
    expect(
      contactNeedsApolloEnrichment({
        email: "test@example.com",
        source: "manual",
        emailStatus: "unverified",
      }),
    ).toBe(true);
  });

  it("returns false for apollo verified email", () => {
    expect(
      contactNeedsApolloEnrichment({
        email: "a@b.com",
        source: "apollo",
        emailStatus: "verified",
      }),
    ).toBe(false);
  });
});

describe("loadContactForEnrichment", () => {
  it("extracts hostname from target website", async () => {
    const fakeDb = {
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              limit: () =>
                Promise.resolve([
                  {
                    id: "c1",
                    dealDeskCompanyId: "co-1",
                    firstName: "A",
                    lastName: "B",
                    title: null,
                    email: null,
                    source: null,
                    emailStatus: "unverified",
                    website: "https://www.acme.com/about",
                  },
                ]),
            }),
          }),
        }),
      }),
    };
    const row = await loadContactForEnrichment(fakeDb as never, {
      companyId: "co-1",
      contactId: "c1",
    });
    expect(row?.companyDomain).toBe("www.acme.com");
  });
});
