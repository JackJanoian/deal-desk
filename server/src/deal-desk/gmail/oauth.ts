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
