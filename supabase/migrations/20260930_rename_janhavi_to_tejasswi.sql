-- ============================================================
-- Migration: Rename staff 'Janhavi V' / 'Janhavi Vaidya' to 'Tejasswi K'
-- ============================================================

-- 1. Update leads table assigned_to
UPDATE public.leads
SET assigned_to = 'Tejasswi K'
WHERE assigned_to ILIKE '%Janhavi%';

-- 2. Update lead_history table created_by if applicable
UPDATE public.lead_history
SET created_by = 'Tejasswi K'
WHERE created_by ILIKE '%Janhavi%';
