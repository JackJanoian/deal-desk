// DEAL DESK: All PE-specific tables. Additive only — no Paperclip tables modified.
//
// Naming convention: every table is `dd_<name>` to namespace cleanly away from
// Paperclip's tables and to keep upstream merges unambiguous.
//
// FKs to Paperclip tables (companies, agents, issues) are intentionally NOT
// declared at the SQL level — they're tracked by varchar/uuid columns named
// paperclipCompanyId / sourcedByAgentId / sourceTicketId so that schema changes
// in Paperclip don't cascade into Deal Desk. The values are always valid
// Paperclip IDs by application convention.

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  numeric,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ── Enums ─────────────────────────────────────────────────────────────────────

export const ddThesisStatusEnum = pgEnum("dd_thesis_status", [
  "active",
  "paused",
  "archived",
]);

export const ddTargetStatusEnum = pgEnum("dd_target_status", [
  "sourced",
  "qualified",
  "contacted",
  "replied",
  "meeting_booked",
  "in_diligence",
  "passed",
  "closed_won",
  "closed_lost",
]);

export const ddEmailStatusEnum = pgEnum("dd_email_status", [
  "unverified",
  "verified",
  "bounced",
  "invalid",
]);

export const ddSuppressionReasonEnum = pgEnum("dd_suppression_reason", [
  "unsubscribed",
  "bounced",
  "manual",
  "replied_not_interested",
]);

export const ddOutreachSendStatusEnum = pgEnum("dd_outreach_send_status", [
  "queued",
  "awaiting_approval",
  "sent",
  "replied",
  "bounced",
  "unsubscribed",
  "failed",
]);

// ── dd_theses ──────────────────────────────────────────────────────────────────
// An investment mandate. Linked to Paperclip's companies via paperclipCompanyId
// (no FK constraint — merge-safe).

export const ddTheses = pgTable(
  "dd_theses",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    paperclipCompanyId: uuid("paperclip_company_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    sector: varchar("sector", { length: 255 }).notNull(),
    subSectors: jsonb("sub_sectors").notNull().default([]),
    geos: jsonb("geos").notNull().default([]),
    revenueMin: numeric("revenue_min", { precision: 15, scale: 2 }),
    revenueMax: numeric("revenue_max", { precision: 15, scale: 2 }),
    ebitdaMin: numeric("ebitda_min", { precision: 15, scale: 2 }),
    ebitdaMax: numeric("ebitda_max", { precision: 15, scale: 2 }),
    dealSizeMin: numeric("deal_size_min", { precision: 15, scale: 2 }),
    dealSizeMax: numeric("deal_size_max", { precision: 15, scale: 2 }),
    ownershipPreferences: jsonb("ownership_preferences").notNull().default([]),
    exclusionCriteria: text("exclusion_criteria"),
    narrative: text("narrative"),
    status: ddThesisStatusEnum("status").notNull().default("active"),
    templateSlug: varchar("template_slug", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("dd_theses_company_id_idx").on(table.paperclipCompanyId),
    statusIdx: index("dd_theses_status_idx").on(table.status),
  }),
);

// ── dd_targets ─────────────────────────────────────────────────────────────────
// A company sourced by an agent against a thesis.

export const ddTargets = pgTable(
  "dd_targets",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    paperclipCompanyId: uuid("paperclip_company_id").notNull(),
    thesisId: uuid("thesis_id")
      .notNull()
      .references(() => ddTheses.id, { onDelete: "cascade" }),
    sourcedByAgentId: uuid("sourced_by_agent_id"),
    sourceTicketId: uuid("source_ticket_id"),
    companyName: varchar("company_name", { length: 255 }).notNull(),
    website: varchar("website", { length: 2048 }),
    description: text("description"),
    sector: varchar("sector", { length: 255 }),
    subSector: varchar("sub_sector", { length: 255 }),
    hqCity: varchar("hq_city", { length: 255 }),
    hqState: varchar("hq_state", { length: 100 }),
    hqCountry: varchar("hq_country", { length: 100 }).notNull().default("US"),
    estimatedRevenue: numeric("estimated_revenue", { precision: 15, scale: 2 }),
    estimatedEbitda: numeric("estimated_ebitda", { precision: 15, scale: 2 }),
    estimatedEmployees: integer("estimated_employees"),
    ownershipType: varchar("ownership_type", { length: 100 }),
    fitScore: integer("fit_score"),
    fitRationale: text("fit_rationale"),
    sources: jsonb("sources").notNull().default([]),
    status: ddTargetStatusEnum("status").notNull().default("sourced"),
    tags: jsonb("tags").notNull().default([]),
    notes: text("notes"),
    crmExternalId: varchar("crm_external_id", { length: 255 }),
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("dd_targets_company_id_idx").on(table.paperclipCompanyId),
    thesisIdx: index("dd_targets_thesis_id_idx").on(table.thesisId),
    statusIdx: index("dd_targets_status_idx").on(table.status),
    fitScoreIdx: index("dd_targets_fit_score_idx").on(table.fitScore),
    companyNameUq: uniqueIndex("dd_targets_company_name_idx").on(
      table.paperclipCompanyId,
      table.companyName,
    ),
  }),
);

// ── dd_intermediaries ──────────────────────────────────────────────────────────

export const ddIntermediaries = pgTable(
  "dd_intermediaries",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    paperclipCompanyId: uuid("paperclip_company_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    firm: varchar("firm", { length: 255 }),
    title: varchar("title", { length: 255 }),
    coverageSectors: jsonb("coverage_sectors").notNull().default([]),
    coverageSizeMin: numeric("coverage_size_min", { precision: 15, scale: 2 }),
    coverageSizeMax: numeric("coverage_size_max", { precision: 15, scale: 2 }),
    email: varchar("email", { length: 255 }),
    linkedinUrl: varchar("linkedin_url", { length: 2048 }),
    phone: varchar("phone", { length: 50 }),
    recentDeals: jsonb("recent_deals").notNull().default([]),
    lastTouchDate: date("last_touch_date"),
    cadenceDays: integer("cadence_days").notNull().default(60),
    nextTouchDue: date("next_touch_due"),
    relationshipStrength: integer("relationship_strength").notNull().default(1),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("dd_intermediaries_company_id_idx").on(table.paperclipCompanyId),
    nextTouchDueIdx: index("dd_intermediaries_next_touch_due_idx").on(table.nextTouchDue),
  }),
);

// ── dd_contacts ────────────────────────────────────────────────────────────────

export const ddContacts = pgTable(
  "dd_contacts",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    targetId: uuid("target_id")
      .notNull()
      .references(() => ddTargets.id, { onDelete: "cascade" }),
    paperclipCompanyId: uuid("paperclip_company_id").notNull(),
    firstName: varchar("first_name", { length: 255 }).notNull(),
    lastName: varchar("last_name", { length: 255 }),
    title: varchar("title", { length: 255 }),
    email: varchar("email", { length: 255 }),
    emailStatus: ddEmailStatusEnum("email_status").notNull().default("unverified"),
    linkedinUrl: varchar("linkedin_url", { length: 2048 }),
    phone: varchar("phone", { length: 50 }),
    enrichedByAgentId: uuid("enriched_by_agent_id"),
    enrichedAt: timestamp("enriched_at", { withTimezone: true }),
    source: varchar("source", { length: 100 }),
    isPrimary: boolean("is_primary").notNull().default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    targetIdx: index("dd_contacts_target_id_idx").on(table.targetId),
    companyIdx: index("dd_contacts_company_id_idx").on(table.paperclipCompanyId),
  }),
);

// ── dd_outreach_campaigns ──────────────────────────────────────────────────────

export const ddOutreachCampaigns = pgTable(
  "dd_outreach_campaigns",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    paperclipCompanyId: uuid("paperclip_company_id").notNull(),
    thesisId: uuid("thesis_id").references(() => ddTheses.id, { onDelete: "set null" }),
    name: varchar("name", { length: 255 }).notNull(),
    cadenceSteps: jsonb("cadence_steps").notNull().default([]),
    dailySendCap: integer("daily_send_cap").notNull().default(30),
    approvalMode: boolean("approval_mode").notNull().default(true),
    fromMailboxRef: varchar("from_mailbox_ref", { length: 255 }),
    status: varchar("status", { length: 50 }).notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("dd_outreach_campaigns_company_id_idx").on(table.paperclipCompanyId),
  }),
);

// ── dd_outreach_sends ──────────────────────────────────────────────────────────

export const ddOutreachSends = pgTable(
  "dd_outreach_sends",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    paperclipCompanyId: uuid("paperclip_company_id").notNull(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => ddOutreachCampaigns.id, { onDelete: "cascade" }),
    targetId: uuid("target_id")
      .notNull()
      .references(() => ddTargets.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => ddContacts.id, { onDelete: "set null" }),
    cadenceStep: integer("cadence_step").notNull().default(0),
    subject: varchar("subject", { length: 500 }).notNull(),
    body: text("body").notNull(),
    status: ddOutreachSendStatusEnum("status").notNull().default("queued"),
    draftedByAgentId: uuid("drafted_by_agent_id"),
    approvedByUserId: uuid("approved_by_user_id"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    scheduledSendAt: timestamp("scheduled_send_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    externalMessageId: varchar("external_message_id", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("dd_outreach_sends_company_id_idx").on(table.paperclipCompanyId),
    campaignIdx: index("dd_outreach_sends_campaign_id_idx").on(table.campaignId),
    statusIdx: index("dd_outreach_sends_status_idx").on(table.status),
    campaignContactStepUq: uniqueIndex(
      "dd_outreach_sends_campaign_contact_step_idx",
    ).on(table.campaignId, table.contactId, table.cadenceStep),
  }),
);

// ── dd_suppression_list ────────────────────────────────────────────────────────

export const ddSuppressionList = pgTable(
  "dd_suppression_list",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    paperclipCompanyId: uuid("paperclip_company_id").notNull(),
    emailOrDomain: varchar("email_or_domain", { length: 255 }).notNull(),
    reason: ddSuppressionReasonEnum("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyEmailUq: uniqueIndex("dd_suppression_list_company_email_idx").on(
      table.paperclipCompanyId,
      table.emailOrDomain,
    ),
  }),
);

// ── dd_memos ───────────────────────────────────────────────────────────────────

export const ddMemos = pgTable(
  "dd_memos",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    paperclipCompanyId: uuid("paperclip_company_id").notNull(),
    generatedByAgentId: uuid("generated_by_agent_id"),
    weekStartDate: date("week_start_date").notNull(),
    markdown: text("markdown").notNull(),
    metricsSnapshot: jsonb("metrics_snapshot").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("dd_memos_company_id_idx").on(table.paperclipCompanyId),
    companyWeekUq: uniqueIndex("dd_memos_company_week_idx").on(
      table.paperclipCompanyId,
      table.weekStartDate,
    ),
  }),
);

// ── dd_role_templates ──────────────────────────────────────────────────────────
// Phase 8 — pre-built agent role configurations the UI "Hire" dialog reads.
// Seeded at server startup from server/src/deal-desk/seeds/role-templates.ts.

export const ddRoleTemplates = pgTable(
  "dd_role_templates",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    slug: varchar("slug", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description").notNull(),
    defaultHeartbeatCron: varchar("default_heartbeat_cron", { length: 100 }).notNull(),
    defaultBudgetUsd: integer("default_budget_usd").notNull().default(50),
    skillFiles: jsonb("skill_files").notNull().default([]),
    systemPrompt: text("system_prompt").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugUq: uniqueIndex("dd_role_templates_slug_idx").on(table.slug),
  }),
);
