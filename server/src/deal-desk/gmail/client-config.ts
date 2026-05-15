const CLIENT_ID_KEY = "gmail_oauth.client_id";
const CLIENT_SECRET_KEY = "gmail_oauth.client_secret";

export interface GmailClientConfig {
  clientId: string;
  clientSecret: string;
}

export interface GmailClientConfigStore {
  getByKey(args: { companyId: string; key: string }): Promise<{ secretId: string } | null>;
  create(args: {
    companyId: string;
    key: string;
    name: string;
    plaintext: string;
  }): Promise<{ secretId: string }>;
  replace(args: { companyId: string; secretId: string; plaintext: string }): Promise<void>;
  remove(args: { companyId: string; secretId: string }): Promise<void>;
  load(args: { companyId: string; secretId: string }): Promise<string>;
}

async function upsert(
  store: GmailClientConfigStore,
  companyId: string,
  key: string,
  plaintext: string,
): Promise<void> {
  const existing = await store.getByKey({ companyId, key });
  if (existing) {
    await store.replace({ companyId, secretId: existing.secretId, plaintext });
  } else {
    await store.create({ companyId, key, name: key, plaintext });
  }
}

export async function saveGmailOAuthClient(
  input: { companyId: string; clientId: string; clientSecret: string },
  deps: { store: GmailClientConfigStore },
): Promise<void> {
  await upsert(deps.store, input.companyId, CLIENT_ID_KEY, input.clientId);
  await upsert(deps.store, input.companyId, CLIENT_SECRET_KEY, input.clientSecret);
}

export async function loadGmailOAuthClient(
  input: { companyId: string },
  deps: { store: GmailClientConfigStore },
): Promise<GmailClientConfig | null> {
  const idRef = await deps.store.getByKey({ companyId: input.companyId, key: CLIENT_ID_KEY });
  const secretRef = await deps.store.getByKey({
    companyId: input.companyId,
    key: CLIENT_SECRET_KEY,
  });
  if (!idRef || !secretRef) return null;
  const [clientId, clientSecret] = await Promise.all([
    deps.store.load({ companyId: input.companyId, secretId: idRef.secretId }),
    deps.store.load({ companyId: input.companyId, secretId: secretRef.secretId }),
  ]);
  return { clientId, clientSecret };
}

export async function deleteGmailOAuthClient(
  input: { companyId: string },
  deps: { store: GmailClientConfigStore },
): Promise<void> {
  for (const key of [CLIENT_ID_KEY, CLIENT_SECRET_KEY]) {
    const ref = await deps.store.getByKey({ companyId: input.companyId, key });
    if (ref) {
      await deps.store.remove({ companyId: input.companyId, secretId: ref.secretId });
    }
  }
}
