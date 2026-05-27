-- Run this SQL in your Supabase SQL Editor to create the tables required for the WhatsApp Flow Builder

CREATE TABLE IF NOT EXISTS public.whatsapp_flows (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    created_by TEXT,
    status BOOLEAN DEFAULT true,
    nodes JSONB DEFAULT '[]'::jsonb,
    edges JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add an RLS policy if needed (Assuming open access for authenticated users or dashboard usage)
ALTER TABLE public.whatsapp_flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to whatsapp_flows" ON public.whatsapp_flows
    FOR ALL
    USING (true)
    WITH CHECK (true);
