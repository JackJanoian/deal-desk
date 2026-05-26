import type { Request, Response } from "express";
import { z } from "zod";
import type { ApolloConfigStore } from "../enrichment/apollo-config.js";
import {
  saveApolloApiKey,
  deleteApolloApiKey,
  saveApolloCapabilities,
  loadApolloCapabilities,
  APOLLO_API_KEY_SECRET_KEY,
} from "../enrichment/apollo-config.js";
import { probeApolloKeyCapabilities } from "../enrichment/apollo-client.js";
import { ApolloApiError } from "../enrichment/apollo-client.js";

export interface ApolloApiKeyDeps {
  store: ApolloConfigStore;
  probeCapabilities?: typeof probeApolloKeyCapabilities;
}

export function apolloApiKeyGetHandler(deps: ApolloApiKeyDeps) {
  return async (req: Request, res: Response) => {
    const companyId = req.params.companyId as string;
    const existing = await deps.store.getByKey(companyId, APOLLO_API_KEY_SECRET_KEY);
    const capabilities = await loadApolloCapabilities({ companyId }, { store: deps.store });
    res.status(200).json({
      configured: existing !== null,
      matchEnabled: capabilities?.matchEnabled ?? null,
      searchEnabled: capabilities?.searchEnabled ?? null,
      enrichmentEnabled: capabilities?.enrichmentEnabled ?? null,
      planLimited: capabilities?.planLimited ?? null,
      masterKeyRequired: capabilities?.masterKeyRequired ?? null,
      lastValidatedAt: capabilities?.lastValidatedAt ?? null,
    });
  };
}

const postBodySchema = z.object({
  apiKey: z.string().min(8),
});

export function apolloApiKeyPostHandler(deps: ApolloApiKeyDeps) {
  const probe = deps.probeCapabilities ?? probeApolloKeyCapabilities;
  return async (req: Request, res: Response) => {
    const parsed = postBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, reason: "Invalid input", details: parsed.error.flatten() });
      return;
    }
    const companyId = req.params.companyId as string;
    await saveApolloApiKey({ companyId, apiKey: parsed.data.apiKey }, { store: deps.store });

    try {
      const capabilities = await probe(parsed.data.apiKey);
      await saveApolloCapabilities({ companyId, capabilities }, { store: deps.store });
      res.status(200).json({ ok: true, capabilities });
    } catch (err) {
      if (err instanceof ApolloApiError && err.code === "apollo_auth_failed") {
        res.status(400).json({
          ok: false,
          reason: "Apollo API key is invalid or unauthorized",
          code: err.code,
        });
        return;
      }
      res.status(200).json({
        ok: true,
        capabilities: {
          matchEnabled: false,
          searchEnabled: false,
          enrichmentEnabled: false,
          planLimited: false,
          masterKeyRequired: false,
          lastValidatedAt: new Date().toISOString(),
        },
        warning: err instanceof Error ? err.message : "Could not validate Apollo key",
      });
    }
  };
}

export function apolloApiKeyDeleteHandler(deps: ApolloApiKeyDeps) {
  return async (req: Request, res: Response) => {
    const companyId = req.params.companyId as string;
    await deleteApolloApiKey({ companyId }, { store: deps.store });
    res.status(200).json({ ok: true });
  };
}
