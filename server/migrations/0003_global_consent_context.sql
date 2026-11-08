-- REVIEW ONLY. Apply once after operator approval and a verified backup.
-- Existing consent/member records remain unchanged. NULL means historical
-- country/language/wording was not captured; never backfill invented evidence.
-- Fresh databases use the updated server/schema.sql instead of this ALTER.
ALTER TABLE notification_consents ADD COLUMN country TEXT
  CHECK (country IS NULL OR country IN ('KR','US','JP','GB','EU','DE','FR','IT','ES','NL'));
ALTER TABLE notification_consents ADD COLUMN language TEXT
  CHECK (language IS NULL OR language IN ('ko','en'));
ALTER TABLE notification_consents ADD COLUMN notice_text TEXT
  CHECK (notice_text IS NULL OR length(notice_text) BETWEEN 1 AND 2000);
