// DEAL DESK: Gmail OAuth start + callback routes for Outreach Analyst email account linking.
import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";
import { buildGmailAuthorizeUrl, exchangeCodeForTokens, fetchGoogleUserEmail } from "../deal-desk/gmail/oauth.js";
import { saveGmailTokens } from "../deal-desk/gmail/tokens.js";
import type { GoogleOAuthConfig } from "../config.js";
import type { Db } from "@paperclipai/db";
import { ddEmailAccounts } from "@paperclipai/db";

// IMPORTANT: The real `secretService` from `../services/secrets.js` does NOT implement the
// `SecretServiceLike` interface expected by `saveGmailTokens`. Specifically:
//
//   - secretService.create() requires `provider`, `providerConfigId`, and `value` as top-level
//     fields, routed through the full provider system (local-encrypted, AWS SSM, etc.).
//     It does NOT accept `{ companyId, key, name, description }` alone.
//   - There is no `addVersion` method on secretService — version creation is bundled into `create`.
//   - There is no `getLatestPlaintext` method — value retrieval goes through `resolveSecretValue`
//     which requires a binding context and the full provider machinery.
//
// TODO (Task 8 gap): Implement a real secretService adapter for the Gmail OAuth callback once the
// team decides which secret provider to use for Gmail tokens (e.g. "local_encrypted") and
// whether a default providerConfig record will be pre-seeded for each company. Until then, the
// /callback route will throw a runtime error if invoked. The /start route and all tests are
// fully functional.
//
// Once resolved, replace `unimplementedSecretAdapter` below with a real adapter such as:
//
//   const realSvc = secretService(input.deps.db);
//   const secretAdapter: SecretServiceLike = {
//     createSecret: async ({ companyId, key, name, description }) => {
//       const created = await realSvc.create(companyId, {
//         name,
//         provider: "local_encrypted", // or configurable
//         value: "__placeholder__",    // replaced by addVersion below
//         key,
//         description,
//       });
//       return { id: created.id };
//     },
//     addVersion: async ({ secretId, key, value }) => {
//       // secretService.create() already writes the first version inline; addVersion
//       // is not a separate operation. Use secretService.addVersion / updateVersion
//       // once that API is exposed, or store the value directly in createSecret above.
//       throw new Error("addVersion: not yet implemented — see Task 8 gap");
//     },
//     getLatestPlaintext: async ({ secretId }) => {
//       // secretService does not expose a plaintext-by-secretId method without a binding
//       // context. Use resolveSecretValue with appropriate consumer context once available.
//       throw new Error("getLatestPlaintext: not yet implemented — see Task 8 gap");
//     },
//   };

function unimplementedSecretAdapter(): never {
  throw new Error(
    "Gmail OAuth callback: secretService adapter is not yet implemented. " +
    "See IMPORTANT comment in server/src/routes/gmail-oauth.ts (Task 8 gap).",
  );
}

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

      // TODO (Task 8 gap): Replace unimplementedSecretAdapter() with a real SecretServiceLike
      // adapter wired to secretService(input.deps.db). See the IMPORTANT comment at the top of
      // this file for the full explanation of the API mismatch.
      const secretAdapter = {
        createSecret: () => unimplementedSecretAdapter(),
        addVersion: () => unimplementedSecretAdapter(),
        getLatestPlaintext: () => unimplementedSecretAdapter(),
      };

      const secretId = await saveGmailTokens(
        { companyId, emailAddress, tokens },
        { secretService: secretAdapter as never },
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
