-- ============================================================
-- SQL Migration: Setup chat_messages table & Realtime for Live Chat
-- Run this in Supabase Dashboard -> SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_phone TEXT NOT NULL,
    user_name TEXT,
    message TEXT NOT NULL,
    sender_type TEXT NOT NULL DEFAULT 'user', -- 'user' | 'admin' | 'bot'
    is_read BOOLEAN DEFAULT false,
    attachment_url TEXT,
    attachment_type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by phone & created_at
CREATE INDEX IF NOT EXISTS idx_chat_messages_phone ON public.chat_messages(user_phone);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists to prevent duplicates
DROP POLICY IF EXISTS "Allow all access to chat_messages" ON public.chat_messages;

-- Allow full read/write access to chat_messages
CREATE POLICY "Allow all access to chat_messages" ON public.chat_messages
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Add wa_waba_id column to session_settings if missing
ALTER TABLE public.session_settings
    ADD COLUMN IF NOT EXISTS wa_waba_id TEXT;

-- Enable Realtime for chat_messages table (ignore if already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
END $$;
