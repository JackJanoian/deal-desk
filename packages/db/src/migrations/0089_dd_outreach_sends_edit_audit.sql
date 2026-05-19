-- DEAL DESK: human edits to agent-drafted outreach sends
ALTER TABLE dd_outreach_sends
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS edited_by_user_id uuid;
