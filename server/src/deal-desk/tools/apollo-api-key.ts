import type { Request, Response } from "express";
import { z } from "zod";
import type { ApolloConfigStore } from "../enrichment/apollo-config.js";
import { saveApolloApiKey, deleteApolloApiKey, APOLLO_API_KEY_SECRET_KEY } from "../enrichment/apollo-config.js";

export interface ApolloApiKeyDeps {
  store: ApolloConfigStore;
}

export function apolloApiKeyGetHandler(deps: ApolloApiKeyDeps) {
  return async (req: Request, res: Response) => {
    const companyId = req.params.companyId as string;
    const existing = await deps.store.getByKey(companyId, APOLLO_API_KEY_SECRET_KEY);
    res.status(200).json({ configured: existing !== null });
  };
}

const postBodySchema = z.object({
  apiKey: z.string().min(8),
});

export function apolloApiKeyPostHandler(deps: ApolloApiKeyDeps) {
  return async (req: Request, res: Response) => {
    const parsed = postBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, reason: "Invalid input", details: parsed.error.flatten() });
      return;
    }
    const companyId = req.params.companyId as string;
    await saveApolloApiKey({ companyId, apiKey: parsed.data.apiKey }, { store: deps.store });
    res.status(200).json({ ok: true });
  };
}

export function apolloApiKeyDeleteHandler(deps: ApolloApiKeyDeps) {
  return async (req: Request, res: Response) => {
    const companyId = req.params.companyId as string;
    await deleteApolloApiKey({ companyId }, { store: deps.store });
    res.status(200).json({ ok: true });
  };
}
