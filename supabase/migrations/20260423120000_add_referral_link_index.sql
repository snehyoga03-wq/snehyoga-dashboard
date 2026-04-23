-- Add a trigram index on referral_link to speed up ILIKE '%ref=slug%' queries
-- This is critical for personal link redirects (SessionRedirect.tsx)
-- The pg_trgm extension enables GIN indexes for pattern matching (LIKE/ILIKE with wildcards)

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_main_data_registration_referral_link_trgm
ON main_data_registration
USING gin (referral_link gin_trgm_ops);
