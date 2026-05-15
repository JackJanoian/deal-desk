import { describe, it, expect, vi } from "vitest";
import { buildGmailAuthorizeUrl, exchangeCodeForTokens } from "../oauth";

describe("buildGmailAuthorizeUrl", () => {
  it("includes client_id, redirect_uri, send scope, offline access, and the state token", () => {
    const url = new URL(
      buildGmailAuthorizeUrl({
        clientId: "cid",
        redirectUri: "https://x.test/cb",
        state: "state-abc",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("redirect_uri")).toBe("https://x.test/cb");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("state-abc");
    expect(url.searchParams.get("scope")).toContain("gmail.send");
  });
});

describe("exchangeCodeForTokens", () => {
  it("POSTs to Google token endpoint and returns parsed tokens", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "at",
        refresh_token: "rt",
        expires_in: 3599,
        scope: "https://www.googleapis.com/auth/gmail.send",
        token_type: "Bearer",
      }),
    });
    const result = await exchangeCodeForTokens(
      { clientId: "cid", clientSecret: "csec", redirectUri: "https://x.test/cb", code: "abc" },
      { fetch: fakeFetch as unknown as typeof fetch },
    );
    expect(result.refreshToken).toBe("rt");
    expect(result.accessToken).toBe("at");
    expect(result.expiresInSeconds).toBe(3599);
  });
});
