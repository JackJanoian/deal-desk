export const APOLLO_API_KEY_SECRET_KEY = "apollo.api_key" as const;
export const APOLLO_CAPABILITIES_SECRET_KEY = "apollo.capabilities" as const;

export interface ApolloCapabilities {
  matchEnabled: boolean;
  searchEnabled: boolean;
  enrichmentEnabled: boolean;
  planLimited: boolean;
  masterKeyRequired: boolean;
  lastValidatedAt: string;
}

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
  if (existing) await ctx.store.remove(existing.id);
  const caps = await ctx.store.getByKey(args.companyId, APOLLO_CAPABILITIES_SECRET_KEY);
  if (caps) await ctx.store.remove(caps.id);
}

export async function saveApolloCapabilities(
  args: { companyId: string; capabilities: ApolloCapabilities },
  ctx: { store: ApolloConfigStore },
): Promise<void> {
  const payload = JSON.stringify(args.capabilities);
  const existing = await ctx.store.getByKey(args.companyId, APOLLO_CAPABILITIES_SECRET_KEY);
  if (existing) {
    await ctx.store.replace(existing.id, { value: payload });
    return;
  }
  await ctx.store.create(args.companyId, {
    name: "Apollo.io Capabilities",
    key: APOLLO_CAPABILITIES_SECRET_KEY,
    value: payload,
    description: "Validated Apollo.io API capabilities for contact enrichment",
  });
}

export async function loadApolloCapabilities(
  args: { companyId: string },
  ctx: { store: ApolloConfigStore },
): Promise<ApolloCapabilities | null> {
  const existing = await ctx.store.getByKey(args.companyId, APOLLO_CAPABILITIES_SECRET_KEY);
  if (!existing) return null;
  const raw = await ctx.store.load(args.companyId, existing.id);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ApolloCapabilities;
  } catch {
    return null;
  }
}
