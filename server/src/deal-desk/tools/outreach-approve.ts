// DEAL DESK: Approve or reject a queued outreach send.
import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import type { Db } from "@dealdesk/db";
import { ddOutreachSends, ddContacts, ddEmailAccounts, ddIntermediaries } from "@dealdesk/db";
import { isUuidLike } from "@dealdesk/shared";
import type { GmailClientConfig } from "../gmail/client-config.js";
import { sendGmail as sendGmailReal } from "../gmail/send.js";
import {
  loadGmailTokens as loadTokensReal,
  ensureFreshAccessToken as ensureFreshReal,
  type GmailSecretStore,
} from "../gmail/tokens.js";
import { secretService } from "../../services/secrets.js";
import {
  contactNeedsApolloEnrichment,
  ensureContactEmailFromApollo,
  loadContactForEnrichment,
} from "../enrichment/resolve-contact-email.js";

export interface ApproveDeps {
  db: Db;
  loadClientConfig: (companyId: string) => Promise<GmailClientConfig | null>;
  loadApolloKey?: (companyId: string) => Promise<string | null>;
  sendGmail?: typeof sendGmailReal;
  loadGmailTokens?: typeof loadTokensReal;
  ensureFreshAccessToken?: typeof ensureFreshReal;
}

function httpStatusForEnrichCode(code: string): number {
  switch (code) {
    case "apollo_plan_blocked":
    case "apollo_credits_exhausted":
    case "missing_contact_fields":
    case "no_email_found":
      return 422;
    case "contact_not_found":
      return 404;
    case "apollo_not_configured":
      return 412;
    default:
      return 502;
  }
}

export function outreachApproveHandler(deps: ApproveDeps) {
  const sendGmail = deps.sendGmail ?? sendGmailReal;
  const loadGmailTokens = deps.loadGmailTokens ?? loadTokensReal;
  const ensureFreshAccessToken = deps.ensureFreshAccessToken ?? ensureFreshReal;

  return async (req: Request, res: Response) => {
    const sendId = req.params.id as string;
    if (req.actor.type !== "board") {
      res.status(403).json({ ok: false, reason: "Only human users can approve outreach sends" });
      return;
    }
    const send = await deps.db.query.ddOutreachSends.findFirst({
      where: and(
        eq(ddOutreachSends.id, sendId),
        eq(ddOutreachSends.dealDeskCompanyId, req.params.companyId as string),
      ),
    });
    if (!send) {
      res.status(404).json({ ok: false, reason: "Send not found" });
      return;
    }
    const clientConfig = await deps.loadClientConfig(send.dealDeskCompanyId);
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

    if (send.intermediaryId) {
      const intermediary = await deps.db.query.ddIntermediaries.findFirst({
        where: eq(ddIntermediaries.id, send.intermediaryId),
      });
      if (!intermediary?.email?.trim()) {
        res.status(400).json({ ok: false, reason: "Intermediary has no email" });
        return;
      }

      const account = await deps.db.query.ddEmailAccounts.findFirst({
        where: eq(ddEmailAccounts.dealDeskCompanyId, send.dealDeskCompanyId),
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
        { companyId: send.dealDeskCompanyId, secretId: account.secretId },
        { store },
      );
      const fresh = await ensureFreshAccessToken({
        tokens: stored,
        clientId: clientConfig.clientId,
        clientSecret: clientConfig.clientSecret,
      });

      const result = await sendGmail(
        {
          accessToken: fresh.accessToken,
          from: account.emailAddress,
          to: intermediary.email,
          subject: send.subject,
          body: send.body,
        },
        {},
      );

      const approvedByUserId =
        req.actor.type === "board" && req.actor.userId && isUuidLike(req.actor.userId)
          ? req.actor.userId
          : null;
      await deps.db
        .update(ddOutreachSends)
        .set({
          status: "sent",
          sentAt: new Date(),
          externalMessageId: result.messageId,
          approvedByUserId,
          approvedAt: new Date(),
        })
        .where(eq(ddOutreachSends.id, sendId));

      res.status(200).json({
        messageId: result.messageId,
        threadId: result.threadId,
        recipientEmail: intermediary.email,
      });
      return;
    }

    if (!send.contactId) {
      res.status(400).json({ ok: false, reason: "Send has no contact" });
      return;
    }

    const loadApolloKey =
      deps.loadApolloKey ??
      (async () => {
        return null;
      });

    const contactBefore = await loadContactForEnrichment(deps.db, {
      companyId: send.dealDeskCompanyId,
      contactId: send.contactId,
    });
    if (!contactBefore) {
      res.status(404).json({ ok: false, reason: "Contact not found" });
      return;
    }

    const apolloKey = await loadApolloKey(send.dealDeskCompanyId);
    let recipientEmail = contactBefore.email;

    if (apolloKey && contactNeedsApolloEnrichment(contactBefore)) {
      const enriched = await ensureContactEmailFromApollo({
        db: deps.db,
        companyId: send.dealDeskCompanyId,
        contactId: send.contactId,
        loadApolloKey,
        enrichedByAgentId: null,
      });
      if (!enriched.ok) {
        res.status(httpStatusForEnrichCode(enriched.code)).json({
          ok: false,
          reason: enriched.reason,
          code: enriched.code,
        });
        return;
      }
      recipientEmail = enriched.email;
    } else if (!recipientEmail) {
      res.status(400).json({ ok: false, reason: "Contact has no email" });
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
      where: eq(ddEmailAccounts.dealDeskCompanyId, send.dealDeskCompanyId),
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
      { companyId: send.dealDeskCompanyId, secretId: account.secretId },
      { store },
    );
    const fresh = await ensureFreshAccessToken({
      tokens: stored,
      clientId: clientConfig.clientId,
      clientSecret: clientConfig.clientSecret,
    });

    const result = await sendGmail(
      {
        accessToken: fresh.accessToken,
        from: account.emailAddress,
        to: recipientEmail ?? contact.email,
        subject: send.subject,
        body: send.body,
      },
      {},
    );

    const approvedByUserId =
      req.actor.type === "board" && req.actor.userId && isUuidLike(req.actor.userId)
        ? req.actor.userId
        : null;
    await deps.db
      .update(ddOutreachSends)
      .set({
        status: "sent",
        sentAt: new Date(),
        externalMessageId: result.messageId,
        approvedByUserId,
        approvedAt: new Date(),
      })
      .where(eq(ddOutreachSends.id, sendId));

    res.status(200).json({
      messageId: result.messageId,
      threadId: result.threadId,
      recipientEmail: recipientEmail ?? contact.email,
    });
  };
}

export function outreachRejectHandler(deps: { db: Db }) {
  return async (req: Request, res: Response) => {
    const sendId = req.params.id as string;
    const send = await deps.db.query.ddOutreachSends.findFirst({
      where: and(
        eq(ddOutreachSends.id, sendId),
        eq(ddOutreachSends.dealDeskCompanyId, req.params.companyId as string),
      ),
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
