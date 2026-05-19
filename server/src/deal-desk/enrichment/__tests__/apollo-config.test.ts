import { describe, it, expect, vi } from "vitest";
import {
  saveApolloApiKey,
  loadApolloApiKey,
  deleteApolloApiKey,
  APOLLO_API_KEY_SECRET_KEY,
  type ApolloConfigStore,
} from "../apollo-config.js";

function makeStore(initial: Record<string, { id: string; value: string }> = {}): ApolloConfigStore {
  const byKey = new Map(Object.entries(initial));
  return {
    async getByKey(_companyId, key) {
      const v = byKey.get(key);
      return v ? { id: v.id } : null;
    },
    async create(companyId, args) {
      const id = `secret-${byKey.size + 1}`;
      byKey.set(args.key, { id, value: args.value });
      return { id };
    },
    async replace(secretId, args) {
      for (const [k, v] of byKey.entries()) {
        if (v.id === secretId) {
          byKey.set(k, { ...v, value: args.value });
          return;
        }
      }
      throw new Error("secret not found");
    },
    async remove(secretId) {
      for (const [k, v] of byKey.entries()) {
        if (v.id === secretId) {
          byKey.delete(k);
          return;
        }
      }
    },
    async load(companyId, secretId) {
      for (const v of byKey.values()) {
        if (v.id === secretId) return v.value;
      }
      return null;
    },
  };
}

describe("apollo-config", () => {
  it("creates the secret on first save and rotates on subsequent save", async () => {
    const store = makeStore();
    await saveApolloApiKey({ companyId: "c1", apiKey: "key-aaa" }, { store });
    expect(await loadApolloApiKey({ companyId: "c1" }, { store })).toBe("key-aaa");

    await saveApolloApiKey({ companyId: "c1", apiKey: "key-bbb" }, { store });
    expect(await loadApolloApiKey({ companyId: "c1" }, { store })).toBe("key-bbb");
  });

  it("loadApolloApiKey returns null when not configured", async () => {
    const store = makeStore();
    expect(await loadApolloApiKey({ companyId: "c1" }, { store })).toBeNull();
  });

  it("deleteApolloApiKey removes the secret", async () => {
    const store = makeStore();
    await saveApolloApiKey({ companyId: "c1", apiKey: "key-aaa" }, { store });
    await deleteApolloApiKey({ companyId: "c1" }, { store });
    expect(await loadApolloApiKey({ companyId: "c1" }, { store })).toBeNull();
  });

  it("uses the documented secret key", () => {
    expect(APOLLO_API_KEY_SECRET_KEY).toBe("apollo.api_key");
  });
});
