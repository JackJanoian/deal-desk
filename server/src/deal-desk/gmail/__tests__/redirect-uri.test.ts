import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Request } from "express";
import {
  localGmailOAuthRedirectUriAlternates,
  resolveGmailOAuthRedirectUri,
  setGmailOAuthPublicOrigin,
} from "../redirect-uri.js";

const ENV_KEYS = [
  "GMAIL_OAUTH_REDIRECT_URI",
  "GOOGLE_OAUTH_REDIRECT_URI",
  "DEALDESK_PUBLIC_URL",
  "DEALDESK_RUNTIME_API_URL",
  "DEALDESK_API_URL",
] as const;

function mockReq(input: {
  protocol?: string;
  host?: string;
  forwardedProto?: string;
  forwardedHost?: string;
}): Request {
  return {
    protocol: input.protocol ?? "http",
    header(name: string) {
      if (name === "x-forwarded-proto") return input.forwardedProto;
      if (name === "x-forwarded-host") return input.forwardedHost;
      if (name === "host") return input.host;
      return undefined;
    },
  } as Request;
}

describe("resolveGmailOAuthRedirectUri", () => {
  const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

  beforeEach(() => {
    setGmailOAuthPublicOrigin(null);
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    setGmailOAuthPublicOrigin(null);
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
  });

  it("prefers an explicit GMAIL_OAUTH_REDIRECT_URI override", () => {
    process.env.GMAIL_OAUTH_REDIRECT_URI = "https://app.example.com/api/oauth/gmail/callback";
    expect(resolveGmailOAuthRedirectUri(mockReq({ host: "localhost:3100" }))).toBe(
      "https://app.example.com/api/oauth/gmail/callback",
    );
  });

  it("uses the canonical public origin set at startup", () => {
    setGmailOAuthPublicOrigin("http://127.0.0.1:3100");
    expect(resolveGmailOAuthRedirectUri(mockReq({ host: "localhost:3100" }))).toBe(
      "http://127.0.0.1:3100/api/oauth/gmail/callback",
    );
  });

  it("falls back to forwarded headers when no canonical origin is configured", () => {
    expect(
      resolveGmailOAuthRedirectUri(
        mockReq({
          host: "internal:3100",
          forwardedProto: "https",
          forwardedHost: "dealdesk.example.com",
        }),
      ),
    ).toBe("https://dealdesk.example.com/api/oauth/gmail/callback");
  });

  it("falls back to the request host", () => {
    expect(resolveGmailOAuthRedirectUri(mockReq({ host: "localhost:3100" }))).toBe(
      "http://localhost:3100/api/oauth/gmail/callback",
    );
  });
});

describe("localGmailOAuthRedirectUriAlternates", () => {
  it("returns the other loopback variant for localhost", () => {
    expect(
      localGmailOAuthRedirectUriAlternates("http://localhost:3100/api/oauth/gmail/callback"),
    ).toEqual(["http://127.0.0.1:3100/api/oauth/gmail/callback"]);
  });

  it("returns the other loopback variant for 127.0.0.1", () => {
    expect(
      localGmailOAuthRedirectUriAlternates("http://127.0.0.1:3100/api/oauth/gmail/callback"),
    ).toEqual(["http://localhost:3100/api/oauth/gmail/callback"]);
  });

  it("returns nothing for non-local hosts", () => {
    expect(
      localGmailOAuthRedirectUriAlternates("https://dealdesk.example.com/api/oauth/gmail/callback"),
    ).toEqual([]);
  });
});
