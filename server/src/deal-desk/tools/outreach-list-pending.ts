// DEAL DESK: Tool handler — list pending outreach sends awaiting partner approval
import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import type { Db } from "@dealdesk/db";
import { ddOutreachSends, ddContacts, ddIntermediaries } from "@dealdesk/db";

export function listPendingOutreachHandler(db: Db) {
  return async (req: Request, res: Response) => {
    const companyId = req.params.companyId as string;
    const rows = await db
      .select({
        id: ddOutreachSends.id,
        dealDeskCompanyId: ddOutreachSends.dealDeskCompanyId,
        campaignId: ddOutreachSends.campaignId,
        targetId: ddOutreachSends.targetId,
        contactId: ddOutreachSends.contactId,
        intermediaryId: ddOutreachSends.intermediaryId,
        cadenceStep: ddOutreachSends.cadenceStep,
        subject: ddOutreachSends.subject,
        body: ddOutreachSends.body,
        status: ddOutreachSends.status,
        draftedByAgentId: ddOutreachSends.draftedByAgentId,
        approvedByUserId: ddOutreachSends.approvedByUserId,
        editedAt: ddOutreachSends.editedAt,
        editedByUserId: ddOutreachSends.editedByUserId,
        approvedAt: ddOutreachSends.approvedAt,
        scheduledSendAt: ddOutreachSends.scheduledSendAt,
        sentAt: ddOutreachSends.sentAt,
        repliedAt: ddOutreachSends.repliedAt,
        externalMessageId: ddOutreachSends.externalMessageId,
        createdAt: ddOutreachSends.createdAt,
        updatedAt: ddOutreachSends.updatedAt,
        contactEmail: ddContacts.email,
        contactEmailStatus: ddContacts.emailStatus,
        contactSource: ddContacts.source,
        contactFirstName: ddContacts.firstName,
        contactLastName: ddContacts.lastName,
        intermediaryName: ddIntermediaries.name,
        intermediaryFirm: ddIntermediaries.firm,
        intermediaryTitle: ddIntermediaries.title,
        intermediaryEmail: ddIntermediaries.email,
      })
      .from(ddOutreachSends)
      .leftJoin(ddContacts, eq(ddOutreachSends.contactId, ddContacts.id))
      .leftJoin(ddIntermediaries, eq(ddOutreachSends.intermediaryId, ddIntermediaries.id))
      .where(
        and(
          eq(ddOutreachSends.dealDeskCompanyId, companyId),
          eq(ddOutreachSends.status, "awaiting_approval"),
        ),
      );

    const sends = rows.map(
      ({
        contactFirstName,
        contactLastName,
        intermediaryName,
        intermediaryFirm,
        intermediaryTitle,
        intermediaryEmail,
        ...send
      }) => ({
        ...send,
        contactName:
          [contactFirstName, contactLastName].filter(Boolean).join(" ").trim() || null,
        intermediaryName: intermediaryName ?? null,
        intermediaryFirm: intermediaryFirm ?? null,
        intermediaryTitle: intermediaryTitle ?? null,
        intermediaryEmail: intermediaryEmail ?? null,
        isIntermediaryCheckIn: Boolean(send.intermediaryId),
      }),
    );

    res.status(200).json({ sends });
  };
}
