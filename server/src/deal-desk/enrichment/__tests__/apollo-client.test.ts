import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  apolloMatchPerson,
  apolloSearchPeople,
  apolloBulkMatchPeople,
  resolvePersonEmail,
  ApolloApiError,
} from "../apollo-client.js";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

describe("apolloMatchPerson", () => {
  it("posts to people/match with the right body and headers", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        person: { email: "a@b.com", email_status: "verified" },
      }),
    });
    const r = await apolloMatchPerson({
      firstName: "Alice",
      lastName: "Smith",
      companyDomain: "acme.com",
      apiKey: "key-xyz",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.apollo.io/api/v1/people/match");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).headers).toMatchObject({
      "Content-Type": "application/json",
      "X-Api-Key": "key-xyz",
    });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({
      first_name: "Alice",
      last_name: "Smith",
      domain: "acme.com",
      reveal_personal_emails: false,
    });
    expect(r).toEqual({ email: "a@b.com", emailStatus: "verified", apolloPersonId: null });
  });

  it("returns null email when person not found", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ person: null }),
    });
    const r = await apolloMatchPerson({
      firstName: "Alice",
      lastName: "Smith",
      companyDomain: "acme.com",
      apiKey: "key-xyz",
    });
    expect(r).toEqual({ email: null, emailStatus: null, apolloPersonId: null });
  });

  it("maps email_status 'guessed' to 'unverified'", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        person: { email: "a@b.com", email_status: "guessed" },
      }),
    });
    const r = await apolloMatchPerson({
      firstName: "A",
      lastName: "B",
      companyDomain: "x.com",
      apiKey: "k",
    });
    expect(r.emailStatus).toBe("unverified");
  });

  it("throws on non-2xx", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "unauthorized",
    });
    await expect(
      apolloMatchPerson({
        firstName: "A",
        lastName: "B",
        companyDomain: "x.com",
        apiKey: "bad",
      }),
    ).rejects.toThrow(/401/);
  });

  it("classifies Apollo plan blocked errors", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => '{"error_code":"API_INACCESSIBLE"}',
    });
    await expect(
      apolloMatchPerson({
        firstName: "A",
        lastName: "B",
        companyDomain: "x.com",
        apiKey: "free-key",
      }),
    ).rejects.toMatchObject({ code: "apollo_plan_blocked" });
  });
});

describe("apolloSearchPeople", () => {
  it("returns matching person ids", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        people: [
          { id: "p-1", first_name: "Alice", last_name: "Smith" },
          { id: "p-2", first_name: "Bob", last_name: "Jones" },
        ],
      }),
    });
    const result = await apolloSearchPeople({
      firstName: "Alice",
      lastName: "Smith",
      companyDomain: "acme.com",
      apiKey: "key",
    });
    expect(result.personIds).toEqual(["p-1"]);
  });
});

describe("apolloBulkMatchPeople", () => {
  it("returns first email from bulk match", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        matches: [{ person: { id: "p-1", email: "a@b.com", email_status: "verified" } }],
      }),
    });
    const result = await apolloBulkMatchPeople({ personIds: ["p-1"], apiKey: "key" });
    expect(result.email).toBe("a@b.com");
  });
});

describe("resolvePersonEmail", () => {
  it("falls back to search + bulk match when direct match has no email", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ person: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          people: [{ id: "p-1", first_name: "Alice", last_name: "Smith" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          matches: [{ person: { email: "alice@acme.com", email_status: "verified" } }],
        }),
      });
    const result = await resolvePersonEmail({
      firstName: "Alice",
      lastName: "Smith",
      companyDomain: "acme.com",
      apiKey: "key",
    });
    expect(result.email).toBe("alice@acme.com");
  });
});

describe("ApolloApiError", () => {
  it("maps inaccessible plans to apollo_plan_blocked", () => {
    const err = new ApolloApiError(403, '{"error_code":"API_INACCESSIBLE"}');
    expect(err.code).toBe("apollo_plan_blocked");
  });
});
