import { pgTable, uuid, varchar, timestamp, pgEnum, index, unique } from "drizzle-orm/pg-core";

export const ddEmailProviderEnum = pgEnum("dd_email_provider", ["gmail"]);

export const ddEmailAccounts = pgTable(
  "dd_email_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paperclipCompanyId: uuid("paperclip_company_id").notNull(),
    provider: ddEmailProviderEnum("provider").notNull(),
    emailAddress: varchar("email_address", { length: 320 }).notNull(),
    secretId: uuid("secret_id").notNull(), // FK conceptually to company_secrets.id
    connectedByUserId: uuid("connected_by_user_id"),
    connectedAt: timestamp("connected_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => ({
    companyIdx: index("dd_email_accounts_company_idx").on(t.paperclipCompanyId),
    uniqueActive: unique("dd_email_accounts_company_email_unique").on(
      t.paperclipCompanyId,
      t.emailAddress,
    ),
  }),
);
