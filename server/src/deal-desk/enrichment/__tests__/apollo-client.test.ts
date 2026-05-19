import { describe, it, expect, vi, beforeEach } from "vitest";
import { apolloMatchPerson } from "../apollo-client.js";

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
    expect(r).toEqual({ email: "a@b.com", emailStatus: "verified" });
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
    expect(r).toEqual({ email: null, emailStatus: null });
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
});
