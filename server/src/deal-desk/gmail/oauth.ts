export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
export const GMAIL_USERINFO_SCOPE = "https://www.googleapis.com/auth/userinfo.email";

export interface BuildAuthorizeUrlInput {
  clientId: string;
  redirectUri: string;
  state: string;
}

export function buildGmailAuthorizeUrl(input: BuildAuthorizeUrlInput): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent", // ensure refresh_token returned every time
    scope: [GMAIL_SEND_SCOPE, GMAIL_USERINFO_SCOPE].join(" "),
    state: input.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface ExchangeCodeInput {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}

export interface ExchangedTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  scope: string;
}

export interface ExchangeDeps {
  fetch?: typeof fetch;
}

export async function exchangeCodeForTokens(
  input: ExchangeCodeInput,
  deps: ExchangeDeps = {},
): Promise<ExchangedTokens> {
  const f = deps.fetch ?? fetch;
  const body = new URLSearchParams({
    code: input.code,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
  });
  const res = await f("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`Gmail token exchange failed: ${res.status}`);
  }
  const json = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
  };
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresInSeconds: json.expires_in,
    scope: json.scope,
  };
}

export async function fetchGoogleUserEmail(
  accessToken: string,
  deps: ExchangeDeps = {},
): Promise<string> {
  const f = deps.fetch ?? fetch;
  const res = await f("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail userinfo failed: ${res.status}`);
  const json = (await res.json()) as { email: string };
  return json.email;
}
