// DEAL DESK: Phase 8 — idempotent seeder for dd_role_templates.
//
// Wired into server startup in server/src/index.ts after migrations succeed.
// Uses INSERT ... ON CONFLICT (slug) DO UPDATE so re-running is safe and edits
// to role-templates.ts propagate without a manual migration.

import type { Db } from "@paperclipai/db";
import { ddRoleTemplates } from "@paperclipai/db";
import { eq, sql } from "drizzle-orm";
import { dealDeskRoleTemplates } from "./role-templates.js";

export async function seedDealDeskRoleTemplates(db: Db): Promise<void> {
  if (dealDeskRoleTemplates.length === 0) return;

  await db
    .insert(ddRoleTemplates)
    .values(
      dealDeskRoleTemplates.map((tpl) => ({
        slug: tpl.slug,
        name: tpl.name,
        description: tpl.description,
        defaultHeartbeatCron: tpl.defaultHeartbeatCron,
        defaultBudgetUsd: tpl.defaultBudgetUsd,
        systemPrompt: tpl.systemPrompt,
      })),
    )
    .onConflictDoUpdate({
      target: ddRoleTemplates.slug,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        defaultHeartbeatCron: sql`excluded.default_heartbeat_cron`,
        defaultBudgetUsd: sql`excluded.default_budget_usd`,
        systemPrompt: sql`excluded.system_prompt`,
        updatedAt: sql`now()`,
      },
    });

  // DEAL DESK: Remove the retired memo-only role if it was seeded before
  // the memo feature was scrapped.
  await db
    .delete(ddRoleTemplates)
    .where(eq(ddRoleTemplates.slug, "dd-pipeline-reporter"));
}
