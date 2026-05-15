import { describe, it, expect, vi } from "vitest";
import { saveGmailTokens, loadGmailTokens, ensureFreshAccessToken, type GmailTokensRecord, type GmailSecretStore } from "../tokens.js";

describe("Gmail token persistence", () => {
  it("saveGmailTokens stores a JSON record and returns the secret id", async () => {
    const stored: Array<{ companyId: string; key: string; name: string; plaintext: string }> = [];
    const fakeStore: GmailSecretStore = {
      store: vi.fn().mockImplementation(async (args) => {
        stored.push(args);
        return { secretId: "sec-1" };
      }),
      loadLatest: vi.fn(),
    };
    const id = await saveGmailTokens(
      {
        companyId: "co-1",
        emailAddress: "alice@example.com",
        tokens: { accessToken: "at", refreshToken: "rt", expiresInSeconds: 3599, scope: "x" },
      },
      { store: fakeStore },
    );

    expect(id).toBe("sec-1");
    expect(stored).toHaveLength(1);
    expect(stored[0]!.key).toBe("gmail_account:alice@example.com");
    expect(stored[0]!.companyId).toBe("co-1");
    const parsed = JSON.parse(stored[0]!.plaintext) as GmailTokensRecord;
    expect(parsed.refreshToken).toBe("rt");
    expect(parsed.accessToken).toBe("at");
    expect(parsed.expiresAt).toBeGreaterThan(Date.now());
  });

  it("loadGmailTokens parses the JSON returned by the store", async () => {
    const fakeStore: GmailSecretStore = {
      store: vi.fn(),
      loadLatest: vi.fn().mockResolvedValue(
        JSON.stringify({
          refreshToken: "rt",
          accessToken: "at",
          expiresAt: 12345,
          scope: "x",
        } satisfies GmailTokensRecord),
      ),
    };
    const result = await loadGmailTokens(
      { companyId: "co-1", secretId: "sec-1" },
      { store: fakeStore },
    );
    expect(result.accessToken).toBe("at");
    expect(result.expiresAt).toBe(12345);
  });
});

describe("ensureFreshAccessToken", () => {
  it("returns the cached access token if not yet near expiry", async () => {
    const tokens: GmailTokensRecord = {
      refreshToken: "rt",
      accessToken: "still-good",
      expiresAt: Date.now() + 10 * 60_000,
      scope: "x",
    };
    const result = await ensureFreshAccessToken(
      { tokens, clientId: "c", clientSecret: "s" },
      { fetch: vi.fn() as unknown as typeof fetch },
    );
    expect(result.accessToken).toBe("still-good");
  });

  it("refreshes when access token expires within 60s", async () => {
    const tokens: GmailTokensRecord = {
      refreshToken: "rt",
      accessToken: "expiring",
      expiresAt: Date.now() + 30_000,
      scope: "x",
    };
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "new-at", expires_in: 3599 }),
    });
    const result = await ensureFreshAccessToken(
      { tokens, clientId: "c", clientSecret: "s" },
      { fetch: fakeFetch as unknown as typeof fetch },
    );
    expect(result.accessToken).toBe("new-at");
    expect(result.expiresAt).toBeGreaterThan(Date.now() + 3_500_000);
  });
});
