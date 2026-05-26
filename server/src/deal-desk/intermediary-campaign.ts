// DEAL DESK: Shared campaign row for intermediary relationship check-in drafts.
import { and, eq } from "drizzle-orm";
import type { Db } from "@dealdesk/db";
import { ddOutreachCampaigns } from "@dealdesk/db";

export const INTERMEDIARY_CHECKIN_CAMPAIGN_NAME = "Intermediary check-ins";

export async function getOrCreateIntermediaryCheckInCampaign(
  db: Db,
  companyId: string,
): Promise<string> {
  const existing = await db.query.ddOutreachCampaigns.findFirst({
    where: and(
      eq(ddOutreachCampaigns.dealDeskCompanyId, companyId),
      eq(ddOutreachCampaigns.name, INTERMEDIARY_CHECKIN_CAMPAIGN_NAME),
    ),
  });
  if (existing) return existing.id;

  const [created] = await db
    .insert(ddOutreachCampaigns)
    .values({
      dealDeskCompanyId: companyId,
      name: INTERMEDIARY_CHECKIN_CAMPAIGN_NAME,
      cadenceSteps: [],
      approvalMode: true,
      status: "active",
    })
    .returning({ id: ddOutreachCampaigns.id });

  if (!created) {
    throw new Error("Failed to create intermediary check-in campaign");
  }
  return created.id;
}
