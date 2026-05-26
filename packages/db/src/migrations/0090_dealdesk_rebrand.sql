-- Rebrand: migrate legacy secret managed mode values
UPDATE "company_secrets" SET "managed_mode" = 'dealdesk_managed' WHERE "managed_mode" = 'dealdesk_managed';
ALTER TABLE "company_secrets" ALTER COLUMN "managed_mode" SET DEFAULT 'dealdesk_managed';
