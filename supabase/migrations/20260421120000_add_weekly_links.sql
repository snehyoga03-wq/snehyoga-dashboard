-- Add weekly links configuration
ALTER TABLE public.session_settings
    ADD COLUMN IF NOT EXISTS active_week INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS weekly_links JSONB DEFAULT '{}'::jsonb;
