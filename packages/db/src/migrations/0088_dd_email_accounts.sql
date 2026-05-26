-- DEAL DESK: connected Gmail accounts (metadata only; tokens live in company_secrets)
CREATE TYPE dd_email_provider AS ENUM ('gmail');

CREATE TABLE dd_email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_desk_company_id UUID NOT NULL,
  provider dd_email_provider NOT NULL,
  email_address VARCHAR(320) NOT NULL,
  secret_id UUID NOT NULL,
  connected_by_user_id UUID,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  CONSTRAINT dd_email_accounts_company_email_unique
    UNIQUE (deal_desk_company_id, email_address)
);

CREATE INDEX dd_email_accounts_company_idx ON dd_email_accounts (deal_desk_company_id);
