-- ============================================================
-- Migration: Create leads table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.leads (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_date      date,
  calling_date        date,
  sr_no               text,
  client_name         text NOT NULL,
  contact             text NOT NULL,
  lead_type           text,
  lead_existing_plan  text,
  lead_status         text NOT NULL DEFAULT 'Follow Up',
  remark              text,
  created_at          timestamptz DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Allow public access for anon and authenticated roles (CRM reads and writes leads)
CREATE POLICY "Allow anon all on leads" ON public.leads
  FOR ALL USING (true);

-- Allow service role full access
CREATE POLICY "Allow service role all on leads" ON public.leads
  FOR ALL USING (auth.role() = 'service_role');
