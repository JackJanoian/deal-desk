-- DEAL DESK: intermediary check-in drafts on the outreach approval queue
ALTER TABLE "dd_outreach_sends" ALTER COLUMN "campaign_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "dd_outreach_sends" ALTER COLUMN "target_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "dd_outreach_sends" ADD COLUMN IF NOT EXISTS "intermediary_id" uuid;--> statement-breakpoint
ALTER TABLE "dd_outreach_sends" ADD CONSTRAINT "dd_outreach_sends_intermediary_id_dd_intermediaries_id_fk" FOREIGN KEY ("intermediary_id") REFERENCES "public"."dd_intermediaries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dd_outreach_sends_intermediary_id_idx" ON "dd_outreach_sends" USING btree ("intermediary_id");
