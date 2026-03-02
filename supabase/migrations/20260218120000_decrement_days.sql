-- =============================================================
-- Auto-decrement days_left daily for active subscribers
-- Skips paused users and users with 0 (or null) days remaining
-- =============================================================

CREATE OR REPLACE FUNCTION public.decrement_subscription_days()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.main_data_registration
  SET days_left = days_left - 1
  WHERE
    (subscription_paused IS NOT TRUE)
    AND (days_left IS NOT NULL AND days_left > 0);
END;
$$;

-- =============================================================
-- Schedule with pg_cron: runs daily at 18:30 UTC = midnight IST
-- =============================================================
-- NOTE: pg_cron extension must be enabled in your Supabase project
-- (it is enabled by default on paid plans).
--
-- Run this in the Supabase SQL Editor:
--
-- SELECT cron.schedule(
--   'daily-decrement-days',           -- job name
--   '30 18 * * *',                    -- 18:30 UTC = 00:00 IST
--   $$ SELECT public.decrement_subscription_days(); $$
-- );
--
-- To check scheduled jobs:   SELECT * FROM cron.job;
-- To remove the job:         SELECT cron.unschedule('daily-decrement-days');
