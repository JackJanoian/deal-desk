import { describe, it, expect, vi } from "vitest";
import { saveGmailTokens, loadGmailTokens, type GmailTokensRecord } from "../tokens";

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
