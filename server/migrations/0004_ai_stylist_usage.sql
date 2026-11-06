-- REVIEW ONLY. No production migration is run by application code.
-- Add to the existing approved D1 database only after operator review/backup.
-- No members, permissions, external requests or charges are created here.
-- Cost units are integer micro-USD (1 USD = 1,000,000 micro-USD).
-- Counters are conservative reservations, not invoices or confirmed charges.
CREATE TABLE IF NOT EXISTS ai_usage_buckets (
  scope TEXT NOT NULL CHECK (scope IN ('user_day','global_day','global_month')),
  period TEXT NOT NULL,
  owner_hash TEXT NOT NULL DEFAULT '',
  reserved_micro_usd INTEGER NOT NULL DEFAULT 0 CHECK (reserved_micro_usd >= 0),
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= 0),
  PRIMARY KEY (scope,period,owner_hash),
  CHECK ((scope = 'user_day' AND length(owner_hash) = 64 AND length(period) = 10)
    OR (scope = 'global_day' AND owner_hash = '' AND length(period) = 10)
    OR (scope = 'global_month' AND owner_hash = '' AND length(period) = 7))
) STRICT;
CREATE TABLE IF NOT EXISTS ai_usage_reservations (
  request_id TEXT PRIMARY KEY,
  owner_hash TEXT NOT NULL CHECK (length(owner_hash) = 64),
  day_utc TEXT NOT NULL CHECK (length(day_utc) = 10),
  month_utc TEXT NOT NULL CHECK (length(month_utc) = 7),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  reserved_micro_usd INTEGER NOT NULL CHECK (reserved_micro_usd > 0),
  input_token_cap INTEGER NOT NULL CHECK (input_token_cap > 0),
  output_token_cap INTEGER NOT NULL CHECK (output_token_cap > 0),
  state TEXT NOT NULL DEFAULT 'reserved' CHECK (state IN ('reserved','succeeded','failed','uncertain')),
  actual_input_tokens INTEGER CHECK (actual_input_tokens IS NULL OR actual_input_tokens >= 0),
  actual_output_tokens INTEGER CHECK (actual_output_tokens IS NULL OR actual_output_tokens >= 0),
  finished_at INTEGER CHECK (finished_at IS NULL OR finished_at >= 0)
) STRICT;
CREATE INDEX IF NOT EXISTS ai_reservations_owner_time ON ai_usage_reservations(owner_hash,created_at);
CREATE INDEX IF NOT EXISTS ai_reservations_created ON ai_usage_reservations(created_at);
-- A single conditional INSERT reserves against all three current counters.
-- Its trigger updates the counters in the same SQLite write transaction.
CREATE TRIGGER IF NOT EXISTS ai_usage_reservation_counters AFTER INSERT ON ai_usage_reservations
BEGIN
  INSERT INTO ai_usage_buckets(scope,period,owner_hash,reserved_micro_usd,request_count,updated_at)
  VALUES('user_day',NEW.day_utc,NEW.owner_hash,NEW.reserved_micro_usd,1,NEW.created_at)
  ON CONFLICT(scope,period,owner_hash) DO UPDATE SET
    reserved_micro_usd = reserved_micro_usd + NEW.reserved_micro_usd,
    request_count = request_count + 1, updated_at = NEW.created_at;
  INSERT INTO ai_usage_buckets(scope,period,owner_hash,reserved_micro_usd,request_count,updated_at)
  VALUES('global_day',NEW.day_utc,'',NEW.reserved_micro_usd,1,NEW.created_at)
  ON CONFLICT(scope,period,owner_hash) DO UPDATE SET
    reserved_micro_usd = reserved_micro_usd + NEW.reserved_micro_usd,
    request_count = request_count + 1, updated_at = NEW.created_at;
  INSERT INTO ai_usage_buckets(scope,period,owner_hash,reserved_micro_usd,request_count,updated_at)
  VALUES('global_month',NEW.month_utc,'',NEW.reserved_micro_usd,1,NEW.created_at)
  ON CONFLICT(scope,period,owner_hash) DO UPDATE SET
    reserved_micro_usd = reserved_micro_usd + NEW.reserved_micro_usd,
    request_count = request_count + 1, updated_at = NEW.created_at;
END;
