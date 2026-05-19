export const APOLLO_API_KEY_SECRET_KEY = "apollo.api_key" as const;

export interface ApolloConfigStore {
  getByKey(companyId: string, key: string): Promise<{ id: string } | null>;
  create(
    companyId: string,
    args: { name: string; key: string; value: string; description?: string },
  ): Promise<{ id: string }>;
  replace(secretId: string, args: { value: string }): Promise<void>;
  remove(secretId: string): Promise<void>;
  load(companyId: string, secretId: string): Promise<string | null>;
}

export async function saveApolloApiKey(
  args: { companyId: string; apiKey: string },
  ctx: { store: ApolloConfigStore },
): Promise<void> {
  const existing = await ctx.store.getByKey(args.companyId, APOLLO_API_KEY_SECRET_KEY);
  if (existing) {
    await ctx.store.replace(existing.id, { value: args.apiKey });
    return;
  }
  await ctx.store.create(args.companyId, {
    name: "Apollo.io API Key",
    key: APOLLO_API_KEY_SECRET_KEY,
    value: args.apiKey,
    description: "Apollo.io API key for contact enrichment",
  });
}

export async function loadApolloApiKey(
  args: { companyId: string },
  ctx: { store: ApolloConfigStore },
): Promise<string | null> {
  const existing = await ctx.store.getByKey(args.companyId, APOLLO_API_KEY_SECRET_KEY);
  if (!existing) return null;
  return ctx.store.load(args.companyId, existing.id);
}

export async function deleteApolloApiKey(
  args: { companyId: string },
  ctx: { store: ApolloConfigStore },
): Promise<void> {
  const existing = await ctx.store.getByKey(args.companyId, APOLLO_API_KEY_SECRET_KEY);
  if (!existing) return;
  await ctx.store.remove(existing.id);
}
