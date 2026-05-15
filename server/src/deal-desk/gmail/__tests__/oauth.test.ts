import { describe, it, expect } from "vitest";
import { buildGmailAuthorizeUrl } from "../oauth";

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
