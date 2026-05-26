import type { Request } from "express";

export const GMAIL_OAUTH_CALLBACK_PATH = "/api/oauth/gmail/callback";

let canonicalPublicOrigin: string | null = null;

/** Set once at server startup so OAuth and the setup wizard share the same base URL. */
export function setGmailOAuthPublicOrigin(origin: string | null | undefined): void {
  const trimmed = origin?.trim();
  if (!trimmed) {
    canonicalPublicOrigin = null;
    return;
  }
  try {
    canonicalPublicOrigin = new URL(trimmed).origin;
  } catch {
    canonicalPublicOrigin = trimmed.replace(/\/$/, "");
  }
}

export function requestOriginFromReq(req: Request): string {
  const forwardedProto = req.header("x-forwarded-proto");
  const proto = forwardedProto?.split(",")[0]?.trim() || req.protocol || "http";
  const host =
    req.header("x-forwarded-host")?.split(",")[0]?.trim() || req.header("host");
  if (!host) {
    throw new Error("Cannot resolve request host for Gmail OAuth redirect URI");
  }
  return `${proto}://${host}`;
}

function normalizeOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/$/, "");
  }
}

function explicitRedirectUriFromEnv(): string | null {
  const raw =
    process.env.GMAIL_OAUTH_REDIRECT_URI?.trim() ||
    process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

function configuredPublicOrigin(): string | null {
  const candidates = [
    canonicalPublicOrigin,
    process.env.DEALDESK_PUBLIC_URL?.trim(),
    process.env.DEALDESK_RUNTIME_API_URL?.trim(),
    process.env.DEALDESK_API_URL?.trim(),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    return normalizeOrigin(candidate);
  }
  return null;
}

export function resolveGmailOAuthRedirectUri(req: Request): string {
  const explicit = explicitRedirectUriFromEnv();
  if (explicit) return explicit;

  const base = configuredPublicOrigin() ?? requestOriginFromReq(req);
  return `${base.replace(/\/$/, "")}${GMAIL_OAUTH_CALLBACK_PATH}`;
}

export function localGmailOAuthRedirectUriAlternates(
  redirectUri: string,
): string[] {
  let port: number | null = null;
  try {
    const url = new URL(redirectUri);
    const hostname = url.hostname.toLowerCase();
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      return [];
    }
    port = url.port ? Number.parseInt(url.port, 10) : url.protocol === "https:" ? 443 : 80;
    if (!Number.isFinite(port)) return [];
  } catch {
    return [];
  }

  const variants = [
    `http://localhost:${port}${GMAIL_OAUTH_CALLBACK_PATH}`,
    `http://127.0.0.1:${port}${GMAIL_OAUTH_CALLBACK_PATH}`,
  ];
  return variants.filter((uri) => uri !== redirectUri);
}
