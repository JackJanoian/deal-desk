// DEAL DESK: Tool handler factories and registration helper.
//
// These are exposed as HTTP endpoints because Paperclip's tool model is
// per-adapter (no generic tool registry).
//
// Phase 5 only builds the handlers + a registration helper. Phase 6 will
// mount the company-scoped router in server/src/app.ts under
// /api/companies/:companyId/deal-desk/...

import { Router, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { ddEmailAccounts, companySecrets } from "@paperclipai/db";
import {
  gmailClientConfigGetHandler,
  gmailClientConfigPostHandler,
  gmailClientConfigDeleteHandler,
} from "./gmail-client-config.js";
import {
  saveGmailOAuthClient,
  loadGmailOAuthClient,
  deleteGmailOAuthClient,
  type GmailClientConfigStore,
} from "../gmail/client-config.js";
import type { GmailSecretStore } from "../gmail/tokens.js";
import { secretService } from "../../services/secrets.js";
import {
  apolloApiKeyGetHandler,
  apolloApiKeyPostHandler,
  apolloApiKeyDeleteHandler,
} from "./apollo-api-key.js";
import {
  type ApolloConfigStore,
  APOLLO_API_KEY_SECRET_KEY,
} from "../enrichment/apollo-config.js";

import { createTargetHandler } from "./create-target.js";
import { listTargetsHandler } from "./list-targets.js";
import { createIntermediaryHandler } from "./create-intermediary.js";
import { listIntermediariesHandler } from "./list-intermediaries.js";
import { recordIntermediaryTouchHandler } from "./record-intermediary-touch.js";
import { enrichContactHandler } from "./enrich-contact.js";
import { outreachDraftHandler } from "./outreach-draft.js";
import { outreachApproveHandler, outreachRejectHandler } from "./outreach-approve.js";
import { outreachEditHandler } from "./outreach-edit.js";
import { listPendingOutreachHandler } from "./outreach-list-pending.js";
import { testGmailSendHandler } from "./test-gmail-send.js";

export {
  createTargetHandler,
  createTargetInputSchema,
  type CreateTargetInput,
  type CreateTargetResult,
} from "./create-target.js";
export {
  listTargetsHandler,
  listTargetsQuerySchema,
  type ListTargetsQuery,
} from "./list-targets.js";
export {
  createIntermediaryHandler,
  createIntermediaryInputSchema,
  type CreateIntermediaryInput,
  type CreateIntermediaryResult,
} from "./create-intermediary.js";
export {
  listIntermediariesHandler,
  listIntermediariesQuerySchema,
  type ListIntermediariesQuery,
} from "./list-intermediaries.js";
export {
  recordIntermediaryTouchHandler,
  recordIntermediaryTouchInputSchema,
  type RecordIntermediaryTouchInput,
} from "./record-intermediary-touch.js";
export {
  enrichContactHandler,
  enrichContactInputSchema,
  type EnrichContactInput,
} from "./enrich-contact.js";
export {
  outreachDraftHandler,
  outreachDraftInputSchema,
  type OutreachDraftInput,
} from "./outreach-draft.js";
export { outreachApproveHandler, outreachRejectHandler } from "./outreach-approve.js";

/**
 * Mount all Deal Desk tool endpoints onto a parent router.
 *
 * The parent router is expected to be scoped to a Paperclip company — that is,
 * `req.params.companyId` must be available on each request. Phase 6 will
 * mount this router under `/api/companies/:companyId/deal-desk/tools`.
 *
 * Sub-paths exposed (all relative to the parent):
 *   POST /targets                      — create a sourced target
 *   GET  /targets                      — list targets for a thesis
 *   POST /intermediaries               — create an intermediary
 *   GET  /intermediaries               — list intermediaries (overdue-first)
 *   POST /intermediaries/touch         — record a touch with an intermediary
 *   POST /contacts/enrich              — enrich a contact (stub w/o API keys)
 *   POST /outreach/sends/:id/approve   — approve and dispatch a queued send
 *   POST /outreach/sends/:id/reject    — reject a queued send
 */
export function registerDealDeskTools(
  parent: Router,
  db: Db,
): Router {
  parent.post("/targets", createTargetHandler(db));
  parent.get("/targets", listTargetsHandler(db));
  parent.post("/intermediaries", createIntermediaryHandler(db));
  parent.get("/intermediaries", listIntermediariesHandler(db));
  parent.post("/intermediaries/touch", recordIntermediaryTouchHandler(db));
  parent.post("/contacts/enrich", enrichContactHandler(db));
  parent.post("/outreach/draft", outreachDraftHandler(db));
  parent.post("/outreach/sends/:id/reject", outreachRejectHandler({ db }));

  parent.get("/outreach/sends/pending", listPendingOutreachHandler(db));

  parent.get("/email-accounts", async (req: Request, res: Response) => {
    const companyId = req.params.companyId as string;
    const rows = await db.query.ddEmailAccounts.findMany({
      where: eq(ddEmailAccounts.paperclipCompanyId, companyId),
    });
    res.status(200).json({ accounts: rows });
  });

  parent.delete("/email-accounts/:id", async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await db
      .update(ddEmailAccounts)
      .set({ revokedAt: new Date() })
      .where(eq(ddEmailAccounts.id, id));
    res.status(200).json({ ok: true });
  });

  const buildClientConfigStore = (): GmailClientConfigStore => {
    const realSvc = secretService(db);
    return {
      getByKey: async ({ companyId, key }) => {
        const row = await db
          .select({ id: companySecrets.id })
          .from(companySecrets)
          .where(
            and(
              eq(companySecrets.companyId, companyId),
              eq(companySecrets.key, key),
              eq(companySecrets.status, "active"),
            ),
          )
          .limit(1);
        return row[0] ? { secretId: row[0].id } : null;
      },
      create: async ({ companyId, key, name, plaintext }) => {
        const created = await realSvc.create(companyId, {
          name,
          key,
          provider: "local_encrypted",
          value: plaintext,
          description: "Gmail OAuth client credentials (Outreach Analyst)",
        });
        return { secretId: created.id };
      },
      replace: async ({ secretId, plaintext }) => {
        await realSvc.rotate(secretId, { value: plaintext });
      },
      remove: async ({ secretId }) => {
        await realSvc.remove(secretId);
      },
      load: async ({ companyId, secretId }) => {
        return await realSvc.resolveSecretValue(companyId, secretId, "latest");
      },
    };
  };

  const clientConfigDeps = {
    loadConfig: ({ companyId }: { companyId: string }) =>
      loadGmailOAuthClient({ companyId }, { store: buildClientConfigStore() }),
    saveConfig: (args: { companyId: string; clientId: string; clientSecret: string }) =>
      saveGmailOAuthClient(args, { store: buildClientConfigStore() }),
    deleteConfig: ({ companyId }: { companyId: string }) =>
      deleteGmailOAuthClient({ companyId }, { store: buildClientConfigStore() }),
    resolveRedirectUri: (req: Request) => {
      const fromEnv = process.env.PAPERCLIP_PUBLIC_URL;
      const base = fromEnv ?? `${req.protocol}://${req.get("host")}`;
      return `${base.replace(/\/$/, "")}/api/oauth/gmail/callback`;
    },
  };

  parent.patch("/outreach/sends/:id", outreachEditHandler({ db }));

  parent.post(
    "/outreach/sends/:id/approve",
    outreachApproveHandler({
      db,
      loadClientConfig: (companyId) => clientConfigDeps.loadConfig({ companyId }),
    }),
  );

  parent.post(
    "/test-gmail-send",
    testGmailSendHandler({
      db,
      loadClientConfig: (companyId) => clientConfigDeps.loadConfig({ companyId }),
      buildStore: (): GmailSecretStore => {
        const inner = buildClientConfigStore();
        return {
          store: async () => {
            throw new Error("store() not used by test-gmail-send");
          },
          loadLatest: ({ companyId, secretId }) => inner.load({ companyId, secretId }),
        };
      },
    }),
  );

  parent.get("/gmail-oauth-client", gmailClientConfigGetHandler(clientConfigDeps));
  parent.post("/gmail-oauth-client", gmailClientConfigPostHandler(clientConfigDeps));
  parent.delete("/gmail-oauth-client", gmailClientConfigDeleteHandler(clientConfigDeps));

  const buildApolloConfigStore = (): ApolloConfigStore => {
    const realSvc = secretService(db);
    return {
      getByKey: async (companyId: string, key: string) => {
        const row = await db
          .select({ id: companySecrets.id })
          .from(companySecrets)
          .where(
            and(
              eq(companySecrets.companyId, companyId),
              eq(companySecrets.key, key),
              eq(companySecrets.status, "active"),
            ),
          )
          .limit(1);
        return row[0] ? { id: row[0].id } : null;
      },
      create: async (companyId: string, args: { name: string; key: string; value: string; description?: string }) => {
        const created = await realSvc.create(companyId, {
          name: args.name,
          key: args.key,
          provider: "local_encrypted",
          value: args.value,
          description: args.description ?? "Apollo.io API key for contact enrichment",
        });
        return { id: created.id };
      },
      replace: async (secretId: string, args: { value: string }) => {
        await realSvc.rotate(secretId, { value: args.value });
      },
      remove: async (secretId: string) => {
        await realSvc.remove(secretId);
      },
      load: async (companyId: string, secretId: string) => {
        return await realSvc.resolveSecretValue(companyId, secretId, "latest");
      },
    };
  };

  const apolloStore = buildApolloConfigStore();
  parent.get("/apollo-api-key", apolloApiKeyGetHandler({ store: apolloStore }));
  parent.post("/apollo-api-key", apolloApiKeyPostHandler({ store: apolloStore }));
  parent.delete("/apollo-api-key", apolloApiKeyDeleteHandler({ store: apolloStore }));

  return parent;
}

/**
 * Build a self-contained Deal Desk tools router. Convenience wrapper for
 * callers that want a single router to mount (Phase 6 may use this directly).
 */
export function dealDeskToolsRouter(db: Db): Router {
  const router = Router({ mergeParams: true });
  return registerDealDeskTools(router, db);
}
