-- =====================================================
-- Migration: Batch-wise Session Links
-- Each day has 6 links (one per batch slot)
-- =====================================================

CREATE TABLE IF NOT EXISTS session_batch_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week INTEGER NOT NULL CHECK (week IN (1, 2)),
  day TEXT NOT NULL CHECK (day IN ('mon','tue','wed','thu','fri','sat','sun')),
  batch_slot TEXT NOT NULL CHECK (batch_slot IN ('5am','6am','8am','5pm','6pm','7pm')),
  link TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(week, day, batch_slot)
);

-- Enable RLS
ALTER TABLE session_batch_links ENABLE ROW LEVEL SECURITY;

-- Allow read for all (users need to read links)
CREATE POLICY "Public read session_batch_links"
  ON session_batch_links FOR SELECT USING (true);

-- Allow insert/update/delete for authenticated (admin)
CREATE POLICY "Authenticated write session_batch_links"
  ON session_batch_links FOR ALL
  USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Seed all 84 empty rows (2 weeks × 7 days × 6 slots)
INSERT INTO session_batch_links (week, day, batch_slot, link)
SELECT w.week, d.day, s.slot, ''
FROM
  (VALUES (1), (2)) AS w(week),
  (VALUES ('mon'),('tue'),('wed'),('thu'),('fri'),('sat'),('sun')) AS d(day),
  (VALUES ('5am'),('6am'),('8am'),('5pm'),('6pm'),('7pm')) AS s(slot)
ON CONFLICT (week, day, batch_slot) DO NOTHING;
