import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";
import {
  buildGmailAuthorizeUrl,
  exchangeCodeForTokens,
  fetchGoogleUserEmail,
} from "../deal-desk/gmail/oauth.js";
import { saveGmailTokens, type GmailSecretStore } from "../deal-desk/gmail/tokens.js";
import type { GmailClientConfig } from "../deal-desk/gmail/client-config.js";
import type { Db } from "@paperclipai/db";
import { ddEmailAccounts } from "@paperclipai/db";
import { secretService } from "../services/secrets.js";

const STATE_COOKIE = "dd_gmail_oauth_state";

export interface CreateRouterInput {
  loadClientConfig: (companyId: string) => Promise<GmailClientConfig | null>;
  resolveRedirectUri: (req: Request) => string;
  resolveCompanyId: (req: Request) => string | null;
  deps: { db: Db };
}

export function createGmailOAuthRouter(input: CreateRouterInput): Router {
  const router = Router();

  router.get("/start", async (req: Request, res: Response) => {
    const companyId = input.resolveCompanyId(req);
    if (!companyId) {
      res.status(400).json({ ok: false, reason: "companyId required" });
      return;
    }
    const clientConfig = await input.loadClientConfig(companyId);
    if (!clientConfig) {
      res.status(412).json({
        ok: false,
        reason:
          "Gmail OAuth client not configured for this company. " +
          "Visit /deal-desk/email-accounts to set it up.",
      });
      return;
    }
    const redirectUri = input.resolveRedirectUri(req);
    const stateValue = `${companyId}.${crypto.randomBytes(16).toString("hex")}`;
    res.cookie(STATE_COOKIE, stateValue, {
      httpOnly: true,
      sameSite: "lax",
      secure: redirectUri.startsWith("https://"),
      maxAge: 10 * 60_000,
    });
    const url = buildGmailAuthorizeUrl({
      clientId: clientConfig.clientId,
      redirectUri,
      state: stateValue,
    });
    res.redirect(url);
  });

  router.get("/callback", async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;
    const cookieState = (req as Request & { cookies?: Record<string, string> }).cookies?.[STATE_COOKIE];
    if (!code || !state || !cookieState || state !== cookieState) {
      res.status(400).send("Invalid OAuth state");
      return;
    }
    const companyId = state.split(".")[0]!;
    const clientConfig = await input.loadClientConfig(companyId);
    if (!clientConfig) {
      res.status(412).send("Gmail OAuth client not configured for this company");
      return;
    }
    const redirectUri = input.resolveRedirectUri(req);
    const tokens = await exchangeCodeForTokens({
      clientId: clientConfig.clientId,
      clientSecret: clientConfig.clientSecret,
      redirectUri,
      code,
    });
    const emailAddress = await fetchGoogleUserEmail(tokens.accessToken);

    const realSvc = secretService(input.deps.db);
    const store: GmailSecretStore = {
      store: async ({ companyId: cid, key, name, plaintext }) => {
        const created = await realSvc.create(cid, {
          name,
          key,
          provider: "local_encrypted",
          value: plaintext,
          description: "Gmail OAuth refresh + access tokens for Outreach Analyst",
        });
        return { secretId: created.id };
      },
      loadLatest: async ({ companyId: cid, secretId }) => {
        return await realSvc.resolveSecretValue(cid, secretId, "latest");
      },
    };

    const secretId = await saveGmailTokens(
      { companyId, emailAddress, tokens },
      { store },
    );
    await input.deps.db.insert(ddEmailAccounts).values({
      paperclipCompanyId: companyId,
      provider: "gmail",
      emailAddress,
      secretId,
    });

    res.clearCookie(STATE_COOKIE);
    res.redirect(
      `/${companyId}/deal-desk/email-accounts?connected=${encodeURIComponent(emailAddress)}`,
    );
  });

  return router;
}
