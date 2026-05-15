// DEAL DESK: Gmail OAuth start + callback routes for Outreach Analyst email account linking.
import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";
import { buildGmailAuthorizeUrl, exchangeCodeForTokens, fetchGoogleUserEmail } from "../deal-desk/gmail/oauth.js";
import { saveGmailTokens, type GmailSecretStore } from "../deal-desk/gmail/tokens.js";
import { secretService } from "../services/secrets.js";
import type { GoogleOAuthConfig } from "../config.js";
import type { Db } from "@paperclipai/db";
import { ddEmailAccounts } from "@paperclipai/db";

const STATE_COOKIE = "dd_gmail_oauth_state";

export interface CreateRouterInput {
  config: GoogleOAuthConfig | null;
  resolveCompanyId: (req: Request) => string | null;
  deps: { db: Db };
}

export function createGmailOAuthRouter(input: CreateRouterInput): Router {
  const router = Router();

  router.get("/start", (req: Request, res: Response) => {
    if (!input.config) {
      res.status(503).json({ ok: false, reason: "Gmail OAuth not configured" });
      return;
    }
    const companyId = input.resolveCompanyId(req);
    if (!companyId) {
      res.status(400).json({ ok: false, reason: "companyId required" });
      return;
    }
    const stateValue = `${companyId}.${crypto.randomBytes(16).toString("hex")}`;
    res.cookie(STATE_COOKIE, stateValue, {
      httpOnly: true,
      sameSite: "lax",
      secure: input.config.redirectUri.startsWith("https://"),
      maxAge: 10 * 60_000,
    });
    const url = buildGmailAuthorizeUrl({
      clientId: input.config.clientId,
      redirectUri: input.config.redirectUri,
      state: stateValue,
    });
    res.redirect(url);
  });

  router.get("/callback", async (req: Request, res: Response) => {
    if (!input.config) {
      res.status(503).send("Gmail OAuth not configured");
      return;
    }
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;
    const cookieState = (req as Request & { cookies?: Record<string, string> }).cookies?.[STATE_COOKIE];
    if (!code || !state || !cookieState || state !== cookieState) {
      res.status(400).send("Invalid OAuth state");
      return;
    }
    const companyId = state.split(".")[0]!;
    try {
      const tokens = await exchangeCodeForTokens({
        clientId: input.config.clientId,
        clientSecret: input.config.clientSecret,
        redirectUri: input.config.redirectUri,
        code,
      });
      const emailAddress = await fetchGoogleUserEmail(tokens.accessToken);

      const realSvc = secretService(input.deps.db);
      const store: GmailSecretStore = {
        store: async ({ companyId, key, name, plaintext }) => {
          const created = await realSvc.create(companyId, {
            name,
            key,
            provider: "local_encrypted",
            value: plaintext,
            description: "Gmail OAuth refresh + access tokens for Outreach Analyst",
          });
          return { secretId: created.id };
        },
        loadLatest: async ({ companyId, secretId }) => {
          return await realSvc.resolveSecretValue(companyId, secretId, "latest");
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
      res.redirect(`/${companyId}/deal-desk/email-accounts?connected=${encodeURIComponent(emailAddress)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).send(`Gmail OAuth callback failed: ${message}`);
    }
  });

  return router;
}
