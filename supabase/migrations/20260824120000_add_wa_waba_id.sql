-- Add WABA (WhatsApp Business Account) ID column to session_settings
ALTER TABLE public.session_settings
    ADD COLUMN IF NOT EXISTS wa_waba_id TEXT;
