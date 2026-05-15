import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "../config";

describe("config: googleOAuth", () => {
  const orig = { ...process.env };
  beforeEach(() => {
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    delete process.env.GOOGLE_OAUTH_REDIRECT_URI;
  });
  afterEach(() => {
    process.env = { ...orig };
  });

  it("returns null googleOAuth when env vars are missing", () => {
    const cfg = loadConfig();
    expect(cfg.googleOAuth).toBeNull();
  });

  it("returns populated googleOAuth when all three env vars are set", () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = "cid";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "csec";
    process.env.GOOGLE_OAUTH_REDIRECT_URI = "https://x.test/cb";
    const cfg = loadConfig();
    expect(cfg.googleOAuth).toEqual({
      clientId: "cid",
      clientSecret: "csec",
      redirectUri: "https://x.test/cb",
    });
  });
});
