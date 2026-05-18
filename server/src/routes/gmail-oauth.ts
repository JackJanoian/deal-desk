import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";
import {
  buildGmailAuthorizeUrl,
  exchangeCodeForTokens,
  fetchGoogleUserEmail,
} from "../deal-desk/gmail/oauth.js";
import type { GmailClientConfig } from "../deal-desk/gmail/client-config.js";
import type { GmailTokensRecord } from "../deal-desk/gmail/tokens.js";
import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { ddEmailAccounts, companies } from "@paperclipai/db";
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

    const tokenRecord: GmailTokensRecord = {
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
      expiresAt: Date.now() + tokens.expiresInSeconds * 1000,
      scope: tokens.scope,
    };
    const tokenJson = JSON.stringify(tokenRecord);
    const realSvc = secretService(input.deps.db);

    const existingAccount = await input.deps.db
      .select({ id: ddEmailAccounts.id, secretId: ddEmailAccounts.secretId })
      .from(ddEmailAccounts)
      .where(
        and(
          eq(ddEmailAccounts.paperclipCompanyId, companyId),
          eq(ddEmailAccounts.emailAddress, emailAddress),
        ),
      )
      .limit(1);

    if (existingAccount[0]) {
      await realSvc.rotate(existingAccount[0].secretId, { value: tokenJson });
      await input.deps.db
        .update(ddEmailAccounts)
        .set({ revokedAt: null, connectedAt: new Date() })
        .where(eq(ddEmailAccounts.id, existingAccount[0].id));
    } else {
      const created = await realSvc.create(companyId, {
        name: `Gmail OAuth (${emailAddress})`,
        key: `gmail_account:${emailAddress}`,
        provider: "local_encrypted",
        value: tokenJson,
        description: "Gmail OAuth refresh + access tokens for Outreach Analyst",
      });
      await input.deps.db.insert(ddEmailAccounts).values({
        paperclipCompanyId: companyId,
        provider: "gmail",
        emailAddress,
        secretId: created.id,
      });
    }

    const companyRow = await input.deps.db
      .select({ issuePrefix: companies.issuePrefix })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);
    const prefix = companyRow[0]?.issuePrefix ?? companyId;

    res.clearCookie(STATE_COOKIE);
    res.redirect(
      `/${prefix}/deal-desk/email-accounts?connected=${encodeURIComponent(emailAddress)}`,
    );
  });

  return router;
}
