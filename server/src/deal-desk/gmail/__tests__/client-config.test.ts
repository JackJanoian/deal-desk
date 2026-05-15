import { describe, it, expect, vi } from "vitest";
import {
  saveGmailOAuthClient,
  loadGmailOAuthClient,
  deleteGmailOAuthClient,
  type GmailClientConfigStore,
} from "../client-config.js";

describe("Gmail OAuth client config", () => {
  it("saveGmailOAuthClient stores client_id and client_secret as two secrets", async () => {
    const writes: Array<{ key: string; plaintext: string }> = [];
    const store: GmailClientConfigStore = {
      getByKey: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async ({ key, plaintext }) => {
        writes.push({ key, plaintext });
        return { secretId: `sec-${key}` };
      }),
      replace: vi.fn(),
      remove: vi.fn(),
      load: vi.fn(),
    };
    await saveGmailOAuthClient(
      { companyId: "co-1", clientId: "abc.apps.googleusercontent.com", clientSecret: "GOCSPX-xxx" },
      { store },
    );
    expect(writes).toEqual([
      { key: "gmail_oauth.client_id", plaintext: "abc.apps.googleusercontent.com" },
      { key: "gmail_oauth.client_secret", plaintext: "GOCSPX-xxx" },
    ]);
  });

  it("saveGmailOAuthClient replaces existing secrets when keys already exist", async () => {
    const store: GmailClientConfigStore = {
      getByKey: vi.fn().mockImplementation(async ({ key }) =>
        key === "gmail_oauth.client_id" ? { secretId: "old-id" } : { secretId: "old-secret" },
      ),
      create: vi.fn(),
      replace: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn(),
      load: vi.fn(),
    };
    await saveGmailOAuthClient(
      { companyId: "co-1", clientId: "new", clientSecret: "new-secret" },
      { store },
    );
    expect(store.replace).toHaveBeenCalledTimes(2);
    expect(store.create).not.toHaveBeenCalled();
  });

  it("loadGmailOAuthClient returns null when either secret is missing", async () => {
    const store: GmailClientConfigStore = {
      getByKey: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      replace: vi.fn(),
      remove: vi.fn(),
      load: vi.fn(),
    };
    const result = await loadGmailOAuthClient({ companyId: "co-1" }, { store });
    expect(result).toBeNull();
  });

  it("loadGmailOAuthClient returns the parsed config when both secrets exist", async () => {
    const store: GmailClientConfigStore = {
      getByKey: vi.fn().mockImplementation(async ({ key }) => ({
        secretId: key === "gmail_oauth.client_id" ? "id-secret" : "secret-secret",
      })),
      create: vi.fn(),
      replace: vi.fn(),
      remove: vi.fn(),
      load: vi.fn().mockImplementation(async ({ secretId }) =>
        secretId === "id-secret" ? "the-id" : "the-secret",
      ),
    };
    const result = await loadGmailOAuthClient({ companyId: "co-1" }, { store });
    expect(result).toEqual({ clientId: "the-id", clientSecret: "the-secret" });
  });

  it("deleteGmailOAuthClient removes both secrets if they exist", async () => {
    const store: GmailClientConfigStore = {
      getByKey: vi.fn().mockImplementation(async ({ key }) => ({
        secretId: key === "gmail_oauth.client_id" ? "id-secret" : "secret-secret",
      })),
      create: vi.fn(),
      replace: vi.fn(),
      remove: vi.fn().mockResolvedValue(undefined),
      load: vi.fn(),
    };
    await deleteGmailOAuthClient({ companyId: "co-1" }, { store });
    expect(store.remove).toHaveBeenCalledWith({ companyId: "co-1", secretId: "id-secret" });
    expect(store.remove).toHaveBeenCalledWith({ companyId: "co-1", secretId: "secret-secret" });
  });
});
