-- ============================================================
-- SQL Script to update Batch Timings and pg_cron Jobs
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Update existing reminder_schedules records
UPDATE reminder_schedules SET slot = '5:00 AM' WHERE slot = '5 AM';
UPDATE reminder_schedules SET slot = '6:00 AM' WHERE slot = '6 AM';
UPDATE reminder_schedules SET slot = '8:00 AM' WHERE slot = '8 AM' OR slot = '7:30 AM';
UPDATE reminder_schedules SET slot = '5:00 PM' WHERE slot = '5 PM';
UPDATE reminder_schedules SET slot = '6:00 PM' WHERE slot = '6 PM';
UPDATE reminder_schedules SET slot = '7:00 PM' WHERE slot = '7 PM' OR slot = '9:00 PM';

-- 2. Update existing users in main_data_registration
UPDATE main_data_registration SET batch_timing = '5:00 AM' WHERE batch_timing = '5 AM';
UPDATE main_data_registration SET batch_timing = '6:00 AM' WHERE batch_timing = '6 AM';
UPDATE main_data_registration SET batch_timing = '8:00 AM' WHERE batch_timing = '8 AM' OR batch_timing = '7:30 AM';
UPDATE main_data_registration SET batch_timing = '5:00 PM' WHERE batch_timing = '5 PM';
UPDATE main_data_registration SET batch_timing = '6:00 PM' WHERE batch_timing = '6 PM';
UPDATE main_data_registration SET batch_timing = '7:00 PM' WHERE batch_timing = '7 PM' OR batch_timing = '9:00 PM';
UPDATE main_data_registration SET batch_timing = '5:00 AM' WHERE batch_timing = 'Unassigned';

-- 3. Unschedule old pg_cron jobs
SELECT cron.unschedule('daily-reminder-5am');
SELECT cron.unschedule('daily-reminder-6am');
SELECT cron.unschedule('daily-reminder-8am');
SELECT cron.unschedule('daily-reminder-5pm');
SELECT cron.unschedule('daily-reminder-6pm');
SELECT cron.unschedule('daily-reminder-7pm');

-- 4. Create new pg_cron jobs 10 minutes BEFORE the batch time
-- (Assuming IST = UTC + 5:30. 10 mins before 5:00 AM IST = 4:50 AM IST = 23:20 UTC)
SELECT cron.schedule(
  'daily-reminder-5am',
  '20 23 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bzqwaxqzggejpejyxhde.supabase.co/functions/v1/send-daily-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('batch_time', '5:00 AM')
  );
  $$
);

-- 10 mins before 6:00 AM IST = 5:50 AM IST = 00:20 UTC
SELECT cron.schedule(
  'daily-reminder-6am',
  '20 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bzqwaxqzggejpejyxhde.supabase.co/functions/v1/send-daily-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('batch_time', '6:00 AM')
  );
  $$
);

-- 10 mins before 8:00 AM IST = 7:50 AM IST = 02:20 UTC
SELECT cron.schedule(
  'daily-reminder-8am',
  '20 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bzqwaxqzggejpejyxhde.supabase.co/functions/v1/send-daily-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('batch_time', '8:00 AM')
  );
  $$
);

-- 10 mins before 5:00 PM IST = 4:50 PM IST = 11:20 UTC
SELECT cron.schedule(
  'daily-reminder-5pm',
  '20 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bzqwaxqzggejpejyxhde.supabase.co/functions/v1/send-daily-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('batch_time', '5:00 PM')
  );
  $$
);

-- 10 mins before 6:00 PM IST = 5:50 PM IST = 12:20 UTC
SELECT cron.schedule(
  'daily-reminder-6pm',
  '20 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bzqwaxqzggejpejyxhde.supabase.co/functions/v1/send-daily-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('batch_time', '6:00 PM')
  );
  $$
);

-- 10 mins before 7:00 PM IST = 6:50 PM IST = 13:20 UTC
SELECT cron.schedule(
  'daily-reminder-7pm',
  '20 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bzqwaxqzggejpejyxhde.supabase.co/functions/v1/send-daily-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('batch_time', '7:00 PM')
  );
  $$
);
