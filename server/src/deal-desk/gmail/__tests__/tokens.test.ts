import { describe, it, expect, vi } from "vitest";
import { saveGmailTokens, loadGmailTokens, ensureFreshAccessToken, type GmailTokensRecord } from "../tokens";

describe("Gmail token persistence", () => {
  it("saveGmailTokens creates a secret with the refresh+access token JSON", async () => {
    const created: Array<{ key: string; value: string }> = [];
    const fakeSvc = {
      createSecret: vi.fn().mockResolvedValue({ id: "sec-1" }),
      addVersion: vi.fn().mockImplementation(async ({ key, value }: { key: string; value: string }) => {
        created.push({ key, value });
        return { version: 1 };
      }),
    };
    const id = await saveGmailTokens({
      companyId: "co-1",
      emailAddress: "alice@example.com",
      tokens: { accessToken: "at", refreshToken: "rt", expiresInSeconds: 3599, scope: "x" },
    }, { secretService: fakeSvc as never });

    expect(id).toBe("sec-1");
    expect(created).toHaveLength(1);
    const parsed = JSON.parse(created[0]!.value) as GmailTokensRecord;
    expect(parsed.refreshToken).toBe("rt");
    expect(parsed.accessToken).toBe("at");
    expect(parsed.expiresAt).toBeGreaterThan(Date.now());
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
