ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS requested_completion_hours INTEGER,
  ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ;

ALTER TABLE mechanics
  ADD COLUMN IF NOT EXISTS work_hours TEXT;

UPDATE mechanics
SET work_hours = COALESCE(
  work_hours,
  CASE
    WHEN address ILIKE '%Downtown%' THEN 'Mon-Sat · 8:00 AM - 8:00 PM'
    WHEN address ILIKE '%Carytown%' THEN 'Mon-Sun · 9:00 AM - 7:00 PM'
    WHEN address ILIKE '%Church Hill%' THEN 'Mon-Sat · 7:30 AM - 6:30 PM'
    ELSE 'Mon-Sat · 8:00 AM - 6:00 PM'
  END
);
