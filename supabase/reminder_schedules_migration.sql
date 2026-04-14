-- ============================================================
-- Migration: Create reminder_schedules table
-- Run once in Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS reminder_schedules (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot              text NOT NULL UNIQUE,        -- "5 AM", "6 AM", etc.
  enabled           boolean DEFAULT true,
  audience          text DEFAULT 'active',       -- 'all' | 'active' | 'inactive' | 'custom'
  custom_users      jsonb DEFAULT '[]',           -- [{name, phone}]
  template_name     text DEFAULT '',
  template_id       text DEFAULT '',
  template_category text DEFAULT '',
  template_params   text DEFAULT '',             -- comma-separated params e.g. "name,slug"
  updated_at        timestamptz DEFAULT now()
);

-- Enable Row Level Security (RLS) - only service role can write
ALTER TABLE reminder_schedules ENABLE ROW LEVEL SECURITY;

-- Allow anon/authenticated full access (CRM reads and writes schedules)
CREATE POLICY "Allow anon all" ON reminder_schedules
  FOR ALL USING (true);


-- Allow service role full access (Edge Function writes logs)
CREATE POLICY "Allow service role all" ON reminder_schedules
  FOR ALL USING (auth.role() = 'service_role');

-- Seed the 6 default time slots so they exist even without editing
INSERT INTO reminder_schedules (slot, enabled, audience, template_params)
VALUES
  ('5 AM',  true, 'active', 'name,slug'),
  ('6 AM',  true, 'active', 'name,slug'),
  ('8 AM',  true, 'active', 'name,slug'),
  ('5 PM',  true, 'active', 'name,slug'),
  ('6 PM',  true, 'active', 'name,slug'),
  ('7 PM',  true, 'active', 'name,slug')
ON CONFLICT (slot) DO NOTHING;
