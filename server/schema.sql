-- Cloudflare D1, applied only after an operator configures authentication and a
-- verified billing integration. Do not insert active memberships from browser
-- requests, JWT subscription claims, or a client-selected trial/paid flag.
-- This schema creates no users, subscriptions, trials, or charges.
-- Timestamps use UTC epoch milliseconds, never seconds or client clocks.
CREATE TABLE IF NOT EXISTS memberships (
  issuer TEXT NOT NULL,
  subject TEXT NOT NULL,
  subscription_status TEXT NOT NULL DEFAULT 'inactive'
    CHECK (subscription_status IN ('inactive', 'active', 'canceled', 'past_due', 'unpaid')),
  paid_through INTEGER CHECK (paid_through IS NULL OR paid_through >= 0),
  payment_verified_at INTEGER CHECK (payment_verified_at IS NULL OR payment_verified_at > 0),
  PRIMARY KEY (issuer, subject),
  CHECK (subscription_status <> 'active' OR (
    paid_through IS NOT NULL AND payment_verified_at IS NOT NULL
    AND paid_through > payment_verified_at
  ))
) STRICT;

-- Only a trusted, signature-verified billing adapter or a reviewed operator
-- process may update these rows. Refunds/revocations must update the status.
-- No billing adapter, webhook, admin update endpoint, or demo grant is included.
