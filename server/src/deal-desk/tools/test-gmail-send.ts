// DEAL DESK: Smoke-test endpoint — proves the full Gmail send chain works
// without needing an existing campaign / contact / target.
import type { Request, Response } from "express";
import { eq, and, isNull, desc } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@dealdesk/db";
import { ddEmailAccounts } from "@dealdesk/db";
import type { GmailClientConfig } from "../gmail/client-config.js";
import type { GmailTokensRecord } from "../gmail/tokens.js";
import {
  loadGmailTokens as loadTokensReal,
  ensureFreshAccessToken as ensureFreshReal,
  type GmailSecretStore,
} from "../gmail/tokens.js";
import { sendGmail as sendGmailReal } from "../gmail/send.js";

const DEFAULT_SUBJECT = "Deal Desk smoke test";
const DEFAULT_BODY =
  "This is a smoke test from the Deal Desk Outreach Analyst pipeline. " +
  "If you're reading this, the Gmail send chain works end-to-end.";

const bodySchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
});

export interface TestGmailSendDeps {
  db: Db;
  loadClientConfig: (companyId: string) => Promise<GmailClientConfig | null>;
  loadTokens?: (
    args: { companyId: string; secretId: string },
    deps: { store: GmailSecretStore },
  ) => Promise<GmailTokensRecord>;
  ensureFreshAccessToken?: typeof ensureFreshReal;
  sendGmail?: typeof sendGmailReal;
  buildStore?: () => GmailSecretStore;
}

export function testGmailSendHandler(deps: TestGmailSendDeps) {
  const loadTokens = deps.loadTokens ?? loadTokensReal;
  const ensureFresh = deps.ensureFreshAccessToken ?? ensureFreshReal;
  const send = deps.sendGmail ?? sendGmailReal;

  return async (req: Request, res: Response) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, reason: "Invalid input", details: parsed.error.flatten() });
      return;
    }
    const companyId = req.params.companyId as string;

    const account = await deps.db.query.ddEmailAccounts.findFirst({
      where: and(
        eq(ddEmailAccounts.dealDeskCompanyId, companyId),
        isNull(ddEmailAccounts.revokedAt),
      ),
      orderBy: [desc(ddEmailAccounts.connectedAt)],
    });
    if (!account) {
      res.status(412).json({ ok: false, reason: "No connected Gmail account" });
      return;
    }

    const clientConfig = await deps.loadClientConfig(companyId);
    if (!clientConfig) {
      res
        .status(412)
        .json({ ok: false, reason: "Gmail OAuth client not configured for this company" });
      return;
    }

    const store = deps.buildStore
      ? deps.buildStore()
      : ({} as GmailSecretStore);
    const tokens = await loadTokens(
      { companyId, secretId: account.secretId },
      { store },
    );
    const fresh = await ensureFresh({
      tokens,
      clientId: clientConfig.clientId,
      clientSecret: clientConfig.clientSecret,
    });

    const result = await send(
      {
        accessToken: fresh.accessToken,
        from: account.emailAddress,
        to: parsed.data.to,
        subject: parsed.data.subject ?? DEFAULT_SUBJECT,
        body: parsed.data.body ?? DEFAULT_BODY,
      },
      {},
    );

    res.status(200).json({
      ok: true,
      from: account.emailAddress,
      to: parsed.data.to,
      messageId: result.messageId,
      threadId: result.threadId,
    });
  };
}
