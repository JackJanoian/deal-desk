-- DEAL DESK: Remove the memo feature and bundled-skill metadata from role templates.

DROP TABLE IF EXISTS "dd_memos";--> statement-breakpoint
ALTER TABLE "dd_role_templates" DROP COLUMN IF EXISTS "skill_files";
