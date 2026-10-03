-- ============================================================
-- Migration: Rename staff 'Tejasswi K' / 'Tejaswi' to 'Tejasswini K'
-- ============================================================

-- 1. Update leads table assigned_to
UPDATE public.leads
SET assigned_to = 'Tejasswini K'
WHERE assigned_to ILIKE '%Tejasswi%' OR assigned_to ILIKE '%Tejaswi%';

-- 2. Update lead_history table created_by if applicable
UPDATE public.lead_history
SET created_by = 'Tejasswini K'
WHERE created_by ILIKE '%Tejasswi%' OR created_by ILIKE '%Tejaswi%';
