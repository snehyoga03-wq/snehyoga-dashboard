-- ============================================================
-- Migration: Add call_connected column to leads table
-- Values: 'connected', 'not_connected', or null
-- ============================================================

ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS call_connected text;
