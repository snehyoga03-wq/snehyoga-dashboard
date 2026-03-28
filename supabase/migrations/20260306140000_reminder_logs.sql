-- =============================================================
-- reminder_logs: Track automated daily reminder sends
-- =============================================================

CREATE TABLE IF NOT EXISTS public.reminder_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_time TEXT NOT NULL,
    phone TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups by date
CREATE INDEX IF NOT EXISTS idx_reminder_logs_created_at ON public.reminder_logs(created_at DESC);

-- Enable RLS (allow service role full access, anon can read)
ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access" ON public.reminder_logs
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read" ON public.reminder_logs
    FOR SELECT TO authenticated USING (true);

-- =============================================================
-- pg_cron schedules for 6 daily time slots
-- IST → UTC conversion (IST = UTC + 5:30)
--
-- Run these in the Supabase SQL Editor AFTER deploying the
-- send-daily-reminders Edge Function:
-- =============================================================
--
-- NOTE: Replace YOUR_CRON_SECRET with your actual CRON_SECRET env variable.
-- The function URL is: https://bzqwaxqzggejpejyxhde.supabase.co/functions/v1/send-daily-reminders
--
-- 5:00 AM IST = 23:30 UTC (previous day)
-- SELECT cron.schedule(
--   'daily-reminder-5am',
--   '30 23 * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://bzqwaxqzggejpejyxhde.supabase.co/functions/v1/send-daily-reminders',
--     headers := jsonb_build_object('Content-Type', 'application/json'),
--     body := jsonb_build_object('batch_time', '5 AM')
--   );
--   $$
-- );
--
-- 6:00 AM IST = 00:30 UTC
-- SELECT cron.schedule(
--   'daily-reminder-6am',
--   '30 0 * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://bzqwaxqzggejpejyxhde.supabase.co/functions/v1/send-daily-reminders',
--     headers := jsonb_build_object('Content-Type', 'application/json'),
--     body := jsonb_build_object('batch_time', '6 AM')
--   );
--   $$
-- );
--
-- 8:00 AM IST = 02:30 UTC
-- SELECT cron.schedule(
--   'daily-reminder-8am',
--   '30 2 * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://bzqwaxqzggejpejyxhde.supabase.co/functions/v1/send-daily-reminders',
--     headers := jsonb_build_object('Content-Type', 'application/json'),
--     body := jsonb_build_object('batch_time', '8 AM')
--   );
--   $$
-- );
--
-- 5:00 PM IST = 11:30 UTC
-- SELECT cron.schedule(
--   'daily-reminder-5pm',
--   '30 11 * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://bzqwaxqzggejpejyxhde.supabase.co/functions/v1/send-daily-reminders',
--     headers := jsonb_build_object('Content-Type', 'application/json'),
--     body := jsonb_build_object('batch_time', '5 PM')
--   );
--   $$
-- );
--
-- 6:00 PM IST = 12:30 UTC
-- SELECT cron.schedule(
--   'daily-reminder-6pm',
--   '30 12 * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://bzqwaxqzggejpejyxhde.supabase.co/functions/v1/send-daily-reminders',
--     headers := jsonb_build_object('Content-Type', 'application/json'),
--     body := jsonb_build_object('batch_time', '6 PM')
--   );
--   $$
-- );
--
-- 7:00 PM IST = 13:30 UTC
-- SELECT cron.schedule(
--   'daily-reminder-7pm',
--   '30 13 * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://bzqwaxqzggejpejyxhde.supabase.co/functions/v1/send-daily-reminders',
--     headers := jsonb_build_object('Content-Type', 'application/json'),
--     body := jsonb_build_object('batch_time', '7 PM')
--   );
--   $$
-- );
--
-- To check scheduled jobs:   SELECT * FROM cron.job;
-- To remove a job:           SELECT cron.unschedule('daily-reminder-5am');
