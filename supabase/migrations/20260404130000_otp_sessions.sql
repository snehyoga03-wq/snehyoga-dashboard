-- OTP sessions for SAP WhatsApp verification
CREATE TABLE IF NOT EXISTS public.otp_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL,
    otp_hash TEXT NOT NULL,      -- SHA-256 hash of the OTP (never store plaintext)
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
    used BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_phone_active
    ON public.otp_sessions(phone, expires_at)
    WHERE used = false;

ALTER TABLE public.otp_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.otp_sessions
    FOR ALL USING (true) WITH CHECK (true);
