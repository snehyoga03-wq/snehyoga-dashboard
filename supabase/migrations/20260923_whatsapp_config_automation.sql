-- Migration: 20260923_whatsapp_config_automation.sql
-- WhatsApp Config & Automation Database Migration

-- 1. session_settings: Ensure columns for WhatsApp and Google Gemini credentials
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session_settings' AND column_name = 'whatsapp_api_token') THEN
        ALTER TABLE public.session_settings ADD COLUMN whatsapp_api_token TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session_settings' AND column_name = 'whatsapp_phone_number_id') THEN
        ALTER TABLE public.session_settings ADD COLUMN whatsapp_phone_number_id TEXT DEFAULT '808910018982018';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session_settings' AND column_name = 'whatsapp_business_account_id') THEN
        ALTER TABLE public.session_settings ADD COLUMN whatsapp_business_account_id TEXT DEFAULT '1564657775051850';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session_settings' AND column_name = 'whatsapp_language_code') THEN
        ALTER TABLE public.session_settings ADD COLUMN whatsapp_language_code TEXT DEFAULT 'en';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session_settings' AND column_name = 'google_ai_studio_key') THEN
        ALTER TABLE public.session_settings ADD COLUMN google_ai_studio_key TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session_settings' AND column_name = 'ai_system_prompt') THEN
        ALTER TABLE public.session_settings ADD COLUMN ai_system_prompt TEXT DEFAULT 'You are the official Snehyoga AI Counselor. Assist students warmly with batch timings (6 AM, 11 AM, 4 PM), subscription plans, yoga therapy guidelines, and joining links. Always be courteous, inspiring, and concise.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session_settings' AND column_name = 'ai_enabled') THEN
        ALTER TABLE public.session_settings ADD COLUMN ai_enabled BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session_settings' AND column_name = 'ai_allowed_numbers') THEN
        ALTER TABLE public.session_settings ADD COLUMN ai_allowed_numbers TEXT DEFAULT '*';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session_settings' AND column_name = 'wa_api_token') THEN
        UPDATE public.session_settings 
        SET whatsapp_api_token = COALESCE(whatsapp_api_token, wa_api_token),
            whatsapp_phone_number_id = COALESCE(whatsapp_phone_number_id, wa_phone_number_id),
            whatsapp_business_account_id = COALESCE(whatsapp_business_account_id, wa_waba_id),
            whatsapp_language_code = COALESCE(whatsapp_language_code, wa_language_code);
    END IF;
END $$;

-- 2. message_batches
CREATE TABLE IF NOT EXISTS public.message_batches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    batch_name TEXT NOT NULL,
    target_audience TEXT DEFAULT 'all',
    template_id TEXT,
    total_messages INT DEFAULT 0,
    delivered_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    status TEXT DEFAULT 'completed' CHECK (status IN ('processing', 'completed', 'cancelled', 'paused')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'message_batches' AND column_name = 'batch_name') THEN
        ALTER TABLE public.message_batches ADD COLUMN batch_name TEXT;
        UPDATE public.message_batches SET batch_name = COALESCE(label, 'Broadcast Batch') WHERE batch_name IS NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'message_batches' AND column_name = 'target_audience') THEN
        ALTER TABLE public.message_batches ADD COLUMN target_audience TEXT DEFAULT 'all';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'message_batches' AND column_name = 'template_id') THEN
        ALTER TABLE public.message_batches ADD COLUMN template_id TEXT;
    END IF;
END $$;

-- 3. message_queue
CREATE TABLE IF NOT EXISTS public.message_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    batch_id UUID REFERENCES public.message_batches(id) ON DELETE CASCADE,
    user_phone TEXT NOT NULL,
    user_name TEXT,
    template_id TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
    error_log TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'message_queue' AND column_name = 'user_phone') THEN
        ALTER TABLE public.message_queue ADD COLUMN user_phone TEXT;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'message_queue' AND column_name = 'phone') THEN
            UPDATE public.message_queue SET user_phone = phone WHERE user_phone IS NULL;
        END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'message_queue' AND column_name = 'error_log') THEN
        ALTER TABLE public.message_queue ADD COLUMN error_log TEXT;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'message_queue' AND column_name = 'last_error') THEN
            UPDATE public.message_queue SET error_log = last_error WHERE error_log IS NULL;
        END IF;
    END IF;
END $$;

-- 4. chat_messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_phone TEXT NOT NULL,
    user_name TEXT,
    message TEXT NOT NULL,
    sender_type TEXT DEFAULT 'user' CHECK (sender_type IN ('user', 'admin', 'bot')),
    attachment_type TEXT,
    attachment_url TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_phone ON public.chat_messages(user_phone);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON public.chat_messages(created_at DESC);

-- 5. ai_knowledge_base
CREATE TABLE IF NOT EXISTS public.ai_knowledge_base (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category TEXT NOT NULL DEFAULT 'General',
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

INSERT INTO public.ai_knowledge_base (category, question, answer)
SELECT * FROM (VALUES
    ('Batches & Timings', 'What are the daily yoga batch timings?', 'Our live yoga sessions take place every Monday to Friday across 3 flexible batches: Morning 6:00 AM – 7:00 AM, Mid-day 11:00 AM – 12:00 PM, and Evening 4:00 PM – 5:00 PM IST.'),
    ('Live Class Link', 'How do I join the live yoga session today?', 'You can join today''s live class directly through your personalized student portal at https://yoga.snehyoga.com/live or use your direct student session link sent to your registered WhatsApp number.'),
    ('Subscription & Fees', 'What are the subscription plans and fees for Snehyoga?', 'Snehyoga offers flexible membership plans: Snehyoga 365 Annual Membership, 9-Day Mind & Spine Program (MSP), 30-Day Advanced Meditation Program (AMP), and Faceyoga Mastery. Reply "Plans" to receive full pricing details.'),
    ('Free Trial / Demo', 'Can I attend a free demo or trial session?', 'Yes! We welcome new students to experience a complimentary demo session. Please let us know your preferred batch time (6 AM, 11 AM, or 4 PM) and our yoga counselor will reserve your spot.'),
    ('Diet Guidelines', 'What diet should I follow before morning yoga?', 'Practice yoga on an empty stomach. You may drink warm water or lemon water 20 minutes prior. Avoid heavy meals at least 2.5 to 3 hours before class.')
) AS v(category, question, answer)
WHERE NOT EXISTS (SELECT 1 FROM public.ai_knowledge_base LIMIT 1);

-- 6. customer_lead_stage
CREATE TABLE IF NOT EXISTS public.customer_lead_stage (
    phone_number TEXT PRIMARY KEY,
    stage TEXT NOT NULL DEFAULT 'New Lead' CHECK (stage IN ('New Lead', 'Paid', 'Interested', 'Follow Up', 'Demo session', 'Lost')),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customer_lead_stage ON public.customer_lead_stage(stage);

-- 7. customer_blocks
CREATE TABLE IF NOT EXISTS public.customer_blocks (
    phone_number TEXT PRIMARY KEY,
    reason TEXT DEFAULT 'Unsubscribed by user request',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS policies
ALTER TABLE public.message_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_lead_stage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_blocks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow full access to message_batches" ON public.message_batches;
    CREATE POLICY "Allow full access to message_batches" ON public.message_batches FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow full access to message_queue" ON public.message_queue;
    CREATE POLICY "Allow full access to message_queue" ON public.message_queue FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow full access to chat_messages" ON public.chat_messages;
    CREATE POLICY "Allow full access to chat_messages" ON public.chat_messages FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow full access to ai_knowledge_base" ON public.ai_knowledge_base;
    CREATE POLICY "Allow full access to ai_knowledge_base" ON public.ai_knowledge_base FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow full access to customer_lead_stage" ON public.customer_lead_stage;
    CREATE POLICY "Allow full access to customer_lead_stage" ON public.customer_lead_stage FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow full access to customer_blocks" ON public.customer_blocks;
    CREATE POLICY "Allow full access to customer_blocks" ON public.customer_blocks FOR ALL USING (true) WITH CHECK (true);
END $$;
