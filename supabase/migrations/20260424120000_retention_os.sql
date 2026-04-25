-- =============================================================
-- RETENTION OS: Database Migration
-- =============================================================
-- Adds lifecycle state tracking to main_data_registration
-- Creates notification log, outreach queue, state log, flow config
-- =============================================================

-- ─── 1. Extend main_data_registration with retention columns ──

ALTER TABLE public.main_data_registration
  ADD COLUMN IF NOT EXISTS lifecycle_state TEXT NOT NULL DEFAULT 'JUST_JOINED',
  ADD COLUMN IF NOT EXISTS state_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS state_override TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS state_override_expires_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS first_session_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_session_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS total_sessions INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sessions_last_30d INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sessions_last_14d INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_activated BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_loyal_member BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS renewal_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_months_active INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS win_back_sent_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS mty_upgrade_shown_at TIMESTAMPTZ DEFAULT NULL;

-- Add constraint for valid lifecycle states
ALTER TABLE public.main_data_registration
  DROP CONSTRAINT IF EXISTS chk_lifecycle_state;

ALTER TABLE public.main_data_registration
  ADD CONSTRAINT chk_lifecycle_state CHECK (
    lifecycle_state IN (
      'JUST_JOINED', 'ONBOARDING', 'ACTIVATED', 'EARLY_RHYTHM',
      'ACTIVE_CORE', 'INCONSISTENT', 'AT_RISK', 'EXPIRING_SOON',
      'RENEWED_MONTHLY', 'YEARLY', 'EXPIRED', 'LOYAL_MEMBER'
    )
  );

-- Index for fast state filtering
CREATE INDEX IF NOT EXISTS idx_mdr_lifecycle_state
  ON public.main_data_registration(lifecycle_state);

CREATE INDEX IF NOT EXISTS idx_mdr_last_session
  ON public.main_data_registration(last_session_at);


-- ─── 2. retention_notification_log ──────────────────────────────

CREATE TABLE IF NOT EXISTS public.retention_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.main_data_registration(id) ON DELETE CASCADE,
  mobile_number TEXT NOT NULL,
  trigger_code TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'delivered', 'failed')),
  sent_at TIMESTAMPTZ,
  message_preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rnl_user_trigger
  ON public.retention_notification_log(mobile_number, trigger_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rnl_trigger_code
  ON public.retention_notification_log(trigger_code, created_at DESC);

ALTER TABLE public.retention_notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.retention_notification_log
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read" ON public.retention_notification_log
  FOR SELECT TO authenticated USING (true);


-- ─── 3. retention_outreach_queue ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.retention_outreach_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.main_data_registration(id) ON DELETE CASCADE,
  mobile_number TEXT NOT NULL,
  user_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  lifecycle_state TEXT,
  assigned_to TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'contacted', 'resolved', 'deferred')),
  deferred_until TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roq_status
  ON public.retention_outreach_queue(status, created_at DESC);

ALTER TABLE public.retention_outreach_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.retention_outreach_queue
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read and update" ON public.retention_outreach_queue
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ─── 4. retention_state_log ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.retention_state_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.main_data_registration(id) ON DELETE CASCADE,
  previous_state TEXT,
  new_state TEXT NOT NULL,
  trigger TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rsl_user
  ON public.retention_state_log(user_id, created_at DESC);

ALTER TABLE public.retention_state_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.retention_state_log
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read" ON public.retention_state_log
  FOR SELECT TO authenticated USING (true);


-- ─── 5. retention_flow_config ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.retention_flow_config (
  trigger_code TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  template_name TEXT NOT NULL DEFAULT '',
  template_id TEXT DEFAULT '',
  template_category TEXT DEFAULT 'UTILITY',
  template_params TEXT DEFAULT 'name',
  cooldown_hours INT NOT NULL DEFAULT 24,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.retention_flow_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.retention_flow_config
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON public.retention_flow_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ─── 6. Seed flow config with all trigger codes ─────────────────

INSERT INTO public.retention_flow_config (trigger_code, enabled, template_name, cooldown_hours, description) VALUES
  -- First 30-day lifecycle
  ('WELCOME_D0',       true, 'welcome_message',      99999, 'Welcome message on signup'),
  ('ONBOARDING_D2',    true, 'onboarding_nudge',      99999, '48h no session nudge'),
  ('ONBOARDING_D5',    true, 'onboarding_support',    99999, '5-day no session re-engagement'),
  ('FIRST_WIN_D1',     true, 'first_session_congrats', 99999, 'First session congratulations'),
  ('RHYTHM_D10',       true, 'momentum_boost',        99999, '2nd session in 14 days'),
  ('PROGRESS_D15',     true, 'progress_reflection',   99999, 'Day 15 progress reflection'),
  ('RENEWAL_D27',      true, 'renewal_reminder_3d',   99999, '3 days before plan end'),
  ('RENEWAL_D30',      true, 'renewal_reminder_1d',   99999, '1 day before plan end'),
  -- Rescue flows
  ('RESCUE_7D',        true, 'rescue_7day',           168,   '7 days since last session'),
  ('RESCUE_14D',       true, 'rescue_14day',          168,   '14 days since last session'),
  ('RESCUE_21D',       true, 'rescue_21day',          99999, '21 days - human outreach trigger'),
  -- Monthly to Yearly upgrade
  ('MTY_INTRO',        true, 'yearly_intro',          99999, 'Day 20 yearly value education'),
  ('MTY_INVITE',       true, 'yearly_invite',         99999, 'Day 25 yearly plan invite'),
  ('MTY_RENEWED',      true, 'yearly_after_renewal',  99999, 'After monthly renewal - upgrade edu'),
  ('MTY_FOLLOWUP',     true, 'yearly_followup',       99999, '7 days after invite - light followup'),
  -- Expiry flows
  ('EXPIRY_7D_ACTIVE', true, 'expiry_active_7d',      99999, '7 days left - active user'),
  ('EXPIRY_7D_ATRISK', true, 'expiry_atrisk_7d',      99999, '7 days left - at risk user'),
  ('EXPIRY_1D',        true, 'expiry_1day',           99999, '1 day before expiry'),
  -- Win-back flows
  ('WINBACK_7D',       true, 'winback_7day',          99999, '7 days after expiry'),
  ('WINBACK_30D',      true, 'winback_30day',         99999, '30 days after expiry'),
  ('WINBACK_60D',      true, 'winback_60day',         99999, '60 days after expiry'),
  -- Yearly user flows
  ('YEARLY_WELCOME',   true, 'yearly_welcome',        99999, 'Yearly plan purchase welcome'),
  ('YEARLY_M3',        true, 'yearly_milestone_3m',   99999, '3-month milestone'),
  ('YEARLY_M6',        true, 'yearly_milestone_6m',   99999, '6-month milestone'),
  ('YEARLY_M11',       true, 'yearly_renewal_30d',    99999, '30 days before yearly expiry')
ON CONFLICT (trigger_code) DO NOTHING;


-- ─── 7. Backfill existing users with attendance data ────────────

-- Update first_session_at, last_session_at, total_sessions
UPDATE public.main_data_registration mdr SET
  first_session_at = sub.first_at,
  last_session_at = sub.last_at,
  total_sessions = sub.cnt,
  is_activated = (sub.cnt > 0)
FROM (
  SELECT
    mobile_number,
    MIN(created_at) AS first_at,
    MAX(created_at) AS last_at,
    COUNT(*) AS cnt
  FROM public.attendance
  GROUP BY mobile_number
) sub
WHERE mdr.mobile_number = sub.mobile_number;

-- Update sessions_last_30d
UPDATE public.main_data_registration mdr SET
  sessions_last_30d = COALESCE(sub.cnt, 0)
FROM (
  SELECT mobile_number, COUNT(*) AS cnt
  FROM public.attendance
  WHERE created_at >= NOW() - INTERVAL '30 days'
  GROUP BY mobile_number
) sub
WHERE mdr.mobile_number = sub.mobile_number;

-- Update sessions_last_14d
UPDATE public.main_data_registration mdr SET
  sessions_last_14d = COALESCE(sub.cnt, 0)
FROM (
  SELECT mobile_number, COUNT(*) AS cnt
  FROM public.attendance
  WHERE created_at >= NOW() - INTERVAL '14 days'
  GROUP BY mobile_number
) sub
WHERE mdr.mobile_number = sub.mobile_number;

-- Estimate total_months_active from created_at
UPDATE public.main_data_registration SET
  total_months_active = GREATEST(1, EXTRACT(MONTH FROM AGE(NOW(), created_at::timestamp))::int)
WHERE created_at IS NOT NULL;
