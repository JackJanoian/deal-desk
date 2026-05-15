// DEAL DESK: Approve or reject a queued outreach send.
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { ddOutreachSends, ddContacts, ddEmailAccounts } from "@paperclipai/db";
import type { GmailClientConfig } from "../gmail/client-config.js";
import { sendGmail as sendGmailReal } from "../gmail/send.js";
import {
  loadGmailTokens as loadTokensReal,
  ensureFreshAccessToken as ensureFreshReal,
  type GmailSecretStore,
} from "../gmail/tokens.js";
import { secretService } from "../../services/secrets.js";

export interface ApproveDeps {
  db: Db;
  loadClientConfig: (companyId: string) => Promise<GmailClientConfig | null>;
  sendGmail?: typeof sendGmailReal;
  loadGmailTokens?: typeof loadTokensReal;
  ensureFreshAccessToken?: typeof ensureFreshReal;
}

export function outreachApproveHandler(deps: ApproveDeps) {
  const sendGmail = deps.sendGmail ?? sendGmailReal;
  const loadGmailTokens = deps.loadGmailTokens ?? loadTokensReal;
  const ensureFreshAccessToken = deps.ensureFreshAccessToken ?? ensureFreshReal;

  return async (req: Request, res: Response) => {
    const sendId = req.params.id as string;
    const send = await deps.db.query.ddOutreachSends.findFirst({
      where: eq(ddOutreachSends.id, sendId),
    });
    if (!send) {
      res.status(404).json({ ok: false, reason: "Send not found" });
      return;
    }
    const clientConfig = await deps.loadClientConfig(send.paperclipCompanyId);
    if (!clientConfig) {
      res.status(412).json({
        ok: false,
        reason: "Gmail OAuth client not configured for this company",
      });
      return;
    }
    if (send.status !== "awaiting_approval") {
      res.status(409).json({
        ok: false,
        reason: `Send status is ${send.status}, not awaiting_approval`,
      });
      return;
    }
    if (!send.contactId) {
      res.status(400).json({ ok: false, reason: "Send has no contact" });
      return;
    }
    const contact = await deps.db.query.ddContacts.findFirst({
      where: eq(ddContacts.id, send.contactId),
    });
    if (!contact?.email) {
      res.status(400).json({ ok: false, reason: "Contact has no email" });
      return;
    }
    const account = await deps.db.query.ddEmailAccounts.findFirst({
      where: eq(ddEmailAccounts.paperclipCompanyId, send.paperclipCompanyId),
    });
    if (!account) {
      res.status(400).json({ ok: false, reason: "No connected Gmail account" });
      return;
    }

    const realSvc = secretService(deps.db);
    const store: GmailSecretStore = {
      store: async () => {
        throw new Error("store() should not be called from approve flow");
      },
      loadLatest: async ({ companyId, secretId }) => {
        return await realSvc.resolveSecretValue(companyId, secretId, "latest");
      },
    };

    const stored = await loadGmailTokens(
      { companyId: send.paperclipCompanyId, secretId: account.secretId },
      { store },
    );
    const fresh = await ensureFreshAccessToken({
      tokens: stored,
      clientId: clientConfig.clientId,
      clientSecret: clientConfig.clientSecret,
    });

    const result = await sendGmail({
      accessToken: fresh.accessToken,
      from: account.emailAddress,
      to: contact.email,
      subject: send.subject,
      body: send.body,
    }, {});

    const userId = (req as Request & { user?: { id?: string } }).user?.id ?? null;
    await deps.db
      .update(ddOutreachSends)
      .set({
        status: "sent",
        sentAt: new Date(),
        externalMessageId: result.messageId,
        approvedByUserId: userId,
        approvedAt: new Date(),
      })
      .where(eq(ddOutreachSends.id, sendId));

    res.status(200).json({ messageId: result.messageId, threadId: result.threadId });
  };
}

export function outreachRejectHandler(deps: { db: Db }) {
  return async (req: Request, res: Response) => {
    const sendId = req.params.id as string;
    const send = await deps.db.query.ddOutreachSends.findFirst({
      where: eq(ddOutreachSends.id, sendId),
    });
    if (!send) {
      res.status(404).json({ ok: false });
      return;
    }
    if (send.status !== "awaiting_approval") {
      res.status(409).json({ ok: false, reason: `Send status is ${send.status}` });
      return;
    }
    await deps.db
      .update(ddOutreachSends)
      .set({ status: "failed" })
      .where(eq(ddOutreachSends.id, sendId));
    res.status(200).json({ ok: true });
  };
}
