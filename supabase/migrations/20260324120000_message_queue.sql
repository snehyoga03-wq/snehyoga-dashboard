-- =============================================================
-- message_queue: Pub/Sub message queue for reliable delivery
-- =============================================================
-- Messages are published to this table by the CRM (publisher)
-- and consumed by the process-message-queue Edge Function (subscriber).
--
-- This decouples message creation from delivery, enabling:
-- - Automatic retry on failure
-- - Rate-limited batch processing
-- - Per-message delivery tracking
-- - Dead-letter queue for permanently failed messages
-- =============================================================

-- Status enum: pending → processing → delivered → failed → dead_letter
CREATE TABLE IF NOT EXISTS public.message_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Message metadata
    phone TEXT NOT NULL,
    user_name TEXT,
    template_name TEXT NOT NULL,
    template_id TEXT,
    template_category TEXT,
    template_params JSONB DEFAULT '[]'::jsonb,

    -- Batch grouping
    batch_id UUID NOT NULL,                     -- Groups messages from same send action
    batch_label TEXT,                            -- e.g. "6 AM batch", "ALL", "CUSTOM"

    -- Delivery status
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'delivered', 'failed', 'dead_letter')),
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    last_error TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ DEFAULT now()      -- For exponential backoff
);

-- ===== Indexes for queue processing =====
-- Fast lookup for pending messages ready for processing
CREATE INDEX IF NOT EXISTS idx_mq_status_retry
    ON public.message_queue(status, next_retry_at)
    WHERE status IN ('pending', 'failed');

-- Fast lookup by batch
CREATE INDEX IF NOT EXISTS idx_mq_batch_id
    ON public.message_queue(batch_id);

-- Timeline browsing
CREATE INDEX IF NOT EXISTS idx_mq_created_at
    ON public.message_queue(created_at DESC);

-- ===== RLS =====
ALTER TABLE public.message_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.message_queue
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read" ON public.message_queue
    FOR SELECT TO authenticated USING (true);


-- =============================================================
-- message_batches: Summary record for each send action
-- =============================================================
CREATE TABLE IF NOT EXISTS public.message_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL,                         -- "6 AM batch", "Manual: All Users", etc.
    template_name TEXT,
    total_messages INTEGER NOT NULL DEFAULT 0,
    delivered_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'processing', 'completed', 'partial_failure')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    created_by TEXT DEFAULT 'system'
);

ALTER TABLE public.message_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.message_batches
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read" ON public.message_batches
    FOR SELECT TO authenticated USING (true);


-- =============================================================
-- Function: Publish messages to queue (called from CRM)
-- Accepts a JSONB array of users and inserts them as individual
-- queue entries, returning the batch_id.
-- =============================================================
CREATE OR REPLACE FUNCTION public.publish_messages(
    p_batch_label TEXT,
    p_template_name TEXT,
    p_template_id TEXT,
    p_template_category TEXT,
    p_users JSONB   -- array of { phone, name, params }
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_batch_id UUID := gen_random_uuid();
    v_user JSONB;
    v_count INTEGER := 0;
BEGIN
    -- Create batch record
    INSERT INTO public.message_batches (id, label, template_name, total_messages, created_by)
    VALUES (v_batch_id, p_batch_label, p_template_name, jsonb_array_length(p_users), 'crm_admin');

    -- Insert individual messages
    FOR v_user IN SELECT * FROM jsonb_array_elements(p_users)
    LOOP
        INSERT INTO public.message_queue (
            batch_id, batch_label, phone, user_name,
            template_name, template_id, template_category,
            template_params
        ) VALUES (
            v_batch_id,
            p_batch_label,
            v_user->>'phone',
            v_user->>'name',
            p_template_name,
            p_template_id,
            p_template_category,
            COALESCE(v_user->'params', '[]'::jsonb)
        );
        v_count := v_count + 1;
    END LOOP;

    RETURN v_batch_id;
END;
$$;
