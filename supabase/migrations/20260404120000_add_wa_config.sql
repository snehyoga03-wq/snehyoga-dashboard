-- Add WhatsApp Business API config to session_settings
-- Replaces Pabbly webhook with direct WhatsApp API integration

ALTER TABLE public.session_settings
    ADD COLUMN IF NOT EXISTS wa_api_token TEXT,
    ADD COLUMN IF NOT EXISTS wa_phone_number_id TEXT DEFAULT '808910018982018',
    ADD COLUMN IF NOT EXISTS wa_language_code TEXT DEFAULT 'en';
