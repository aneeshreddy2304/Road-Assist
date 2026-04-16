ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(10,2);

UPDATE service_requests
SET estimated_cost = COALESCE(estimated_cost, total_cost)
WHERE status IN ('accepted', 'in_progress', 'completed')
  AND total_cost IS NOT NULL;
