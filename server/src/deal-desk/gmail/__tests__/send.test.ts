import { describe, it, expect, vi } from "vitest";
import { buildRfc822Message, sendGmail } from "../send";

describe("buildRfc822Message", () => {
  it("produces RFC822 with From, To, Subject, plain body", () => {
    const raw = buildRfc822Message({
      from: "alice@example.com",
      to: "bob@example.com",
      subject: "Hello",
      body: "Hi Bob,\n\nFirst line.",
    });
    expect(raw).toContain("From: alice@example.com");
    expect(raw).toContain("To: bob@example.com");
    expect(raw).toContain("Subject: Hello");
    expect(raw).toContain("Hi Bob,");
  });
});

describe("sendGmail", () => {
  it("base64url-encodes the RFC822 message and POSTs to gmail.users.messages.send", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "msg-1", threadId: "thread-1" }),
    });
    const result = await sendGmail(
      {
        accessToken: "at",
        from: "alice@example.com",
        to: "bob@example.com",
        subject: "Hello",
        body: "Hi",
      },
      { fetch: fakeFetch as unknown as typeof fetch },
    );
    expect(result.messageId).toBe("msg-1");
    expect(result.threadId).toBe("thread-1");
    const [url, init] = fakeFetch.mock.calls[0]!;
    expect(url).toBe("https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
    expect((init as RequestInit).method).toBe("POST");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer at");
    const sent = JSON.parse((init as RequestInit).body as string) as { raw: string };
    // base64url uses - and _, no padding
    expect(sent.raw).not.toContain("+");
    expect(sent.raw).not.toContain("/");
    expect(sent.raw).not.toContain("=");
  });
});
