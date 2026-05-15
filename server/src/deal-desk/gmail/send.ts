export interface BuildMessageInput {
  from: string;
  to: string;
  subject: string;
  body: string;
}

export function buildRfc822Message(input: BuildMessageInput): string {
  const lines = [
    `From: ${input.from}`,
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    input.body,
  ];
  return lines.join("\r\n");
}

function base64url(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export interface SendInput extends BuildMessageInput {
  accessToken: string;
}

export interface SendResult {
  messageId: string;
  threadId: string;
}

export interface SendDeps {
  fetch?: typeof fetch;
}

export async function sendGmail(input: SendInput, deps: SendDeps = {}): Promise<SendResult> {
  const f = deps.fetch ?? fetch;
  const raw = base64url(buildRfc822Message(input));
  const res = await f("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail send failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { id: string; threadId: string };
  return { messageId: json.id, threadId: json.threadId };
}
