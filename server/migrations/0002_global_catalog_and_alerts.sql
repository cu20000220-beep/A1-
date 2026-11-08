-- REVIEW ONLY. No accounts, offers, consents, deliveries, charges or schedules
-- are created here. Apply only after operator approval, with a backup.
-- All timestamps are UTC epoch milliseconds. Owner identity is issuer+subject.
CREATE TABLE IF NOT EXISTS retailers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  integration_status TEXT NOT NULL DEFAULT 'search_only'
    CHECK (integration_status IN ('search_only','approval_required','configured','disabled','demo')),
  provider_kind TEXT NOT NULL DEFAULT 'search',
  source_url TEXT NOT NULL,
  shipping_countries_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(shipping_countries_json)),
  terms_url TEXT,
  image_rights_note TEXT,
  retention_seconds INTEGER CHECK (retention_seconds IS NULL OR retention_seconds >= 0),
  minimum_refresh_seconds INTEGER CHECK (minimum_refresh_seconds IS NULL OR minimum_refresh_seconds >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= 0)
) STRICT;
CREATE TABLE IF NOT EXISTS product_offers (
  id TEXT PRIMARY KEY,
  retailer_id TEXT NOT NULL REFERENCES retailers(id),
  product_id TEXT NOT NULL,
  brand TEXT NOT NULL,
  product_name TEXT NOT NULL,
  sku TEXT,
  gtin TEXT,
  mpn TEXT,
  color TEXT NOT NULL,
  size TEXT NOT NULL,
  item_condition TEXT NOT NULL,
  seller_country TEXT NOT NULL,
  product_url TEXT NOT NULL,
  price_minor INTEGER NOT NULL CHECK (price_minor >= 0),
  currency TEXT NOT NULL CHECK (currency IN ('KRW','USD','EUR','GBP','JPY')),
  shipping_minor INTEGER CHECK (shipping_minor IS NULL OR shipping_minor >= 0),
  tax_minor INTEGER CHECK (tax_minor IS NULL OR tax_minor >= 0),
  duty_minor INTEGER CHECK (duty_minor IS NULL OR duty_minor >= 0),
  shipping_countries_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(shipping_countries_json)),
  stock_status TEXT NOT NULL CHECK (stock_status IN ('in_stock','out_of_stock','unknown')),
  promotion_price_minor INTEGER CHECK (promotion_price_minor IS NULL OR promotion_price_minor >= 0),
  promotion_starts_at INTEGER,
  promotion_ends_at INTEGER,
  checked_at INTEGER NOT NULL CHECK (checked_at >= 0),
  expires_at INTEGER,
  source_mode TEXT NOT NULL CHECK (source_mode IN ('DEMO','official')),
  source_url TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(payload_json))
) STRICT;
CREATE INDEX IF NOT EXISTS offers_product_variant ON product_offers(product_id,color,size,item_condition);
CREATE INDEX IF NOT EXISTS offers_checked_at ON product_offers(checked_at);
CREATE TABLE IF NOT EXISTS price_history (
  id TEXT PRIMARY KEY,
  offer_id TEXT NOT NULL REFERENCES product_offers(id),
  price_minor INTEGER NOT NULL CHECK (price_minor >= 0),
  currency TEXT NOT NULL CHECK (currency IN ('KRW','USD','EUR','GBP','JPY')),
  shipping_minor INTEGER CHECK (shipping_minor IS NULL OR shipping_minor >= 0),
  tax_minor INTEGER CHECK (tax_minor IS NULL OR tax_minor >= 0),
  duty_minor INTEGER CHECK (duty_minor IS NULL OR duty_minor >= 0),
  observed_at INTEGER NOT NULL CHECK (observed_at >= 0),
  source_url TEXT NOT NULL,
  UNIQUE(offer_id,observed_at)
) STRICT;
CREATE TABLE IF NOT EXISTS product_watchlists (
  id TEXT NOT NULL,
  issuer TEXT NOT NULL,
  subject TEXT NOT NULL,
  product_id TEXT NOT NULL,
  target_price REAL CHECK (target_price IS NULL OR target_price >= 0),
  currency TEXT NOT NULL CHECK (currency IN ('KRW','USD','EUR','GBP','JPY')),
  brand TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  PRIMARY KEY(issuer,subject,id),
  UNIQUE(issuer,subject,product_id,currency)
) STRICT;
CREATE TABLE IF NOT EXISTS promotion_events (
  id TEXT PRIMARY KEY,
  retailer_id TEXT REFERENCES retailers(id),
  product_id TEXT,
  brand TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('price_drop','brand_promotion','promotion_start','target_reached','promotion_ending')),
  starts_at INTEGER NOT NULL CHECK (starts_at >= 0),
  ends_at INTEGER,
  checked_at INTEGER NOT NULL CHECK (checked_at >= 0),
  source_url TEXT NOT NULL,
  source_mode TEXT NOT NULL CHECK (source_mode IN ('DEMO','official')),
  verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0,1)),
  payload_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(payload_json))
) STRICT;
CREATE TABLE IF NOT EXISTS notification_preferences (
  issuer TEXT NOT NULL,
  subject TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'KR',
  time_zone TEXT NOT NULL DEFAULT 'Asia/Seoul',
  language TEXT NOT NULL DEFAULT 'ko' CHECK (language IN ('ko','en')),
  frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('immediate','daily','weekly')),
  email_enabled INTEGER NOT NULL DEFAULT 0 CHECK (email_enabled IN (0,1)),
  sms_enabled INTEGER NOT NULL DEFAULT 0 CHECK (sms_enabled IN (0,1)),
  phone_e164 TEXT,
  phone_verified INTEGER NOT NULL DEFAULT 0 CHECK (phone_verified IN (0,1)),
  brands_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(brands_json)),
  categories_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(categories_json)),
  updated_at INTEGER NOT NULL CHECK (updated_at >= 0),
  PRIMARY KEY(issuer,subject)
) STRICT;
CREATE TABLE IF NOT EXISTS notification_consents (
  id TEXT NOT NULL,
  issuer TEXT NOT NULL,
  subject TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email','sms')),
  granted INTEGER NOT NULL CHECK (granted IN (0,1)),
  policy_version TEXT NOT NULL,
  occurred_at INTEGER NOT NULL CHECK (occurred_at >= 0),
  PRIMARY KEY(issuer,subject,id)
) STRICT;
CREATE INDEX IF NOT EXISTS consents_owner_channel_time ON notification_consents(issuer,subject,channel,occurred_at DESC,id DESC);
CREATE TABLE IF NOT EXISTS notification_deliveries (
  id TEXT NOT NULL,
  issuer TEXT NOT NULL,
  subject TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email','sms')),
  event_id TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('simulated','dry-run','suppressed','failed','pending','queued','sent','bounced','canceled','deleted')),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  payload_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(payload_json)),
  PRIMARY KEY(issuer,subject,id),
  UNIQUE(issuer,subject,channel,dedupe_key)
) STRICT;
CREATE INDEX IF NOT EXISTS deliveries_owner_time ON notification_deliveries(issuer,subject,created_at DESC);
CREATE TABLE IF NOT EXISTS api_rate_limits (
  issuer TEXT NOT NULL,
  subject TEXT NOT NULL,
  window_start INTEGER NOT NULL CHECK (window_start >= 0),
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  PRIMARY KEY(issuer,subject,window_start)
) STRICT;
