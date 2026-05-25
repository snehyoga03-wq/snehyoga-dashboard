-- ============================================================
-- Migration: Update leads table and create lead_history
-- ============================================================

-- Add new columns to leads
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS assigned_to text,
ADD COLUMN IF NOT EXISTS follow_up_date date;

-- Create lead_history table
CREATE TABLE IF NOT EXISTS public.lead_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  description text NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by text
);

-- Enable Row Level Security (RLS) on lead_history
ALTER TABLE public.lead_history ENABLE ROW LEVEL SECURITY;

-- Allow public access for anon and authenticated roles (CRM reads and writes history)
CREATE POLICY "Allow anon all on lead_history" ON public.lead_history
  FOR ALL USING (true);

-- Allow service role full access
CREATE POLICY "Allow service role all on lead_history" ON public.lead_history
  FOR ALL USING (auth.role() = 'service_role');
