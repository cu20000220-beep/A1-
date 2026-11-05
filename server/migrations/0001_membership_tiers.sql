-- REVIEW ONLY. Do not apply to production without operator approval and backup.
-- Proposal: existing paid records retain GENERAL. No row becomes PREMIUM.
-- Apply once to the legacy memberships schema using a migration ledger.
-- Fresh installations use server/schema.sql instead, not this ALTER migration.
CREATE TABLE IF NOT EXISTS membership_plans (
  code TEXT PRIMARY KEY CHECK (code IN ('FREE','GENERAL','PREMIUM')),
  rank INTEGER NOT NULL CHECK (rank BETWEEN 0 AND 2),
  recommendations_enabled INTEGER NOT NULL CHECK (recommendations_enabled IN (0,1)),
  comparison_enabled INTEGER NOT NULL CHECK (comparison_enabled IN (0,1)),
  notifications_enabled INTEGER NOT NULL CHECK (notifications_enabled IN (0,1)),
  price_minor INTEGER DEFAULT NULL CHECK (price_minor IS NULL OR price_minor >= 0),
  billing_currency TEXT DEFAULT NULL
) STRICT;
INSERT OR IGNORE INTO membership_plans(code,rank,recommendations_enabled,comparison_enabled,notifications_enabled)
VALUES ('FREE',0,0,0,0),('GENERAL',1,1,0,0),('PREMIUM',2,1,1,1);
ALTER TABLE memberships ADD COLUMN plan_code TEXT NOT NULL DEFAULT 'GENERAL'
  CHECK (plan_code IN ('FREE','GENERAL','PREMIUM'));
