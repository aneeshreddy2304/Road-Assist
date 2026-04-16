-- ============================================================
-- RoadAssist — Full PostgreSQL Schema
-- Advanced Databases Course Project
-- ============================================================

-- Enable PostGIS for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;
-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('owner', 'mechanic', 'admin');

CREATE TYPE vehicle_type AS ENUM ('car', 'bike', 'truck', 'suv', 'other');

CREATE TYPE request_status AS ENUM (
  'requested',
  'accepted',
  'in_progress',
  'completed',
  'cancelled'
);

CREATE TYPE appointment_status AS ENUM ('requested', 'confirmed', 'completed', 'cancelled');
CREATE TYPE chat_sender_role AS ENUM ('owner', 'mechanic');

CREATE TYPE alert_type AS ENUM ('low_stock', 'new_request', 'system');

-- ============================================================
-- TABLES
-- ============================================================

-- ------------------------------------------------------------
-- users
-- Central identity table for all roles.
-- ------------------------------------------------------------
CREATE TABLE users (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100)  NOT NULL,
  email         VARCHAR(255)  NOT NULL UNIQUE,
  password_hash TEXT          NOT NULL,
  phone         VARCHAR(20),
  gender        VARCHAR(20),
  street_address TEXT,
  city          VARCHAR(100),
  state         VARCHAR(100),
  postal_code   VARCHAR(20),
  role          user_role     NOT NULL DEFAULT 'owner',
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- mechanics
-- Extended profile for users with role = 'mechanic'.
-- location is a PostGIS geography point (lng, lat, SRID 4326).
-- ------------------------------------------------------------
CREATE TABLE mechanics (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  location        GEOGRAPHY(POINT, 4326) NOT NULL,
  address         TEXT,
  specialization  TEXT,                              -- e.g. "engine, brakes, electrical"
  work_hours      TEXT,
  vehicle_types   vehicle_type[]  NOT NULL DEFAULT '{}',
  is_available    BOOLEAN       NOT NULL DEFAULT TRUE,
  rating          NUMERIC(3, 2) NOT NULL DEFAULT 0.00
                  CHECK (rating >= 0 AND rating <= 5),
  total_reviews   INTEGER       NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- vehicles
-- Vehicles registered by owners.
-- ------------------------------------------------------------
CREATE TABLE vehicles (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname        VARCHAR(80),
  make            VARCHAR(50)   NOT NULL,   -- e.g. "Toyota"
  model           VARCHAR(50)   NOT NULL,   -- e.g. "Corolla"
  year            SMALLINT      NOT NULL CHECK (year >= 1900 AND year <= 2100),
  license_plate   VARCHAR(20)   NOT NULL UNIQUE,
  vehicle_type    vehicle_type  NOT NULL,
  fuel_type       VARCHAR(30),
  color           VARCHAR(30),
  notes           TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- spare_parts
-- Inventory of spare parts each mechanic carries.
-- ------------------------------------------------------------
CREATE TABLE spare_parts (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id     UUID          NOT NULL REFERENCES mechanics(id) ON DELETE CASCADE,
  part_name       VARCHAR(150)  NOT NULL,
  part_number     VARCHAR(100),
  quantity        INTEGER       NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  min_threshold   INTEGER       NOT NULL DEFAULT 2 CHECK (min_threshold >= 0),
  price           NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  compatible_vehicles vehicle_type[],
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (mechanic_id, part_number)
);

-- ------------------------------------------------------------
-- service_requests
-- Core job table. One row per assistance request.
-- owner_location stored at time of request.
-- ------------------------------------------------------------
CREATE TABLE service_requests (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID            NOT NULL REFERENCES users(id),
  mechanic_id     UUID            REFERENCES mechanics(id),     -- NULL until accepted
  vehicle_id      UUID            NOT NULL REFERENCES vehicles(id),
  problem_desc    TEXT            NOT NULL,
  status          request_status  NOT NULL DEFAULT 'requested',
  owner_location  GEOGRAPHY(POINT, 4326) NOT NULL,
  requested_completion_hours INTEGER,
  deadline_at     TIMESTAMPTZ,
  estimated_cost  NUMERIC(10,2),                                -- quote shown before completion
  total_cost      NUMERIC(10,2),                                -- filled on completion
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- service_request_parts
-- Parts used/reserved for a specific job.
-- ------------------------------------------------------------
CREATE TABLE service_request_parts (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID          NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  part_id         UUID          NOT NULL REFERENCES spare_parts(id),
  quantity_used   INTEGER       NOT NULL CHECK (quantity_used > 0),
  unit_price      NUMERIC(10,2) NOT NULL,
  UNIQUE (request_id, part_id)
);

-- ------------------------------------------------------------
-- job_updates
-- Full audit trail of every status change on a request.
-- ------------------------------------------------------------
CREATE TABLE job_updates (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID            NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  status          request_status  NOT NULL,
  updated_by      UUID            NOT NULL REFERENCES users(id),
  note            TEXT,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- reviews
-- One review per completed service request.
-- ------------------------------------------------------------
CREATE TABLE reviews (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID          NOT NULL UNIQUE REFERENCES service_requests(id),
  owner_id        UUID          NOT NULL REFERENCES users(id),
  mechanic_id     UUID          NOT NULL REFERENCES mechanics(id),
  rating          SMALLINT      NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment         TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- alerts
-- Auto-generated by DB triggers. Displayed on mechanic dashboard.
-- ------------------------------------------------------------
CREATE TABLE alerts (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id     UUID          NOT NULL REFERENCES mechanics(id) ON DELETE CASCADE,
  part_id         UUID          REFERENCES spare_parts(id) ON DELETE SET NULL,
  alert_type      alert_type    NOT NULL DEFAULT 'low_stock',
  message         TEXT          NOT NULL,
  is_resolved     BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- appointments
-- Future bookings for planned services.
-- ------------------------------------------------------------
CREATE TABLE appointments (
  id              UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID                NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mechanic_id     UUID                NOT NULL REFERENCES mechanics(id) ON DELETE CASCADE,
  vehicle_id      UUID                REFERENCES vehicles(id) ON DELETE SET NULL,
  scheduled_for   TIMESTAMPTZ         NOT NULL,
  service_type    VARCHAR(120)        NOT NULL,
  notes           TEXT,
  status          appointment_status  NOT NULL DEFAULT 'requested',
  estimated_cost  NUMERIC(10,2),
  created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- chat_messages
-- Owner-mechanic messaging thread.
-- ------------------------------------------------------------
CREATE TABLE chat_messages (
  id              UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID               NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mechanic_id     UUID               NOT NULL REFERENCES mechanics(id) ON DELETE CASCADE,
  sender_user_id  UUID               NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_role     chat_sender_role   NOT NULL,
  message         TEXT               NOT NULL,
  created_at      TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- audit_log
-- Immutable log of all sensitive table changes.
-- old_data / new_data store full row snapshots as JSONB.
-- ------------------------------------------------------------
CREATE TABLE audit_log (
  id              BIGSERIAL     PRIMARY KEY,
  table_name      VARCHAR(50)   NOT NULL,
  operation       VARCHAR(10)   NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  old_data        JSONB,
  new_data        JSONB,
  performed_by    UUID          REFERENCES users(id) ON DELETE SET NULL,
  changed_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Mechanic location — the most critical index (used in every nearby search)
CREATE INDEX idx_mechanics_location
  ON mechanics USING GIST (location);

-- Mechanic availability filter (often combined with location)
CREATE INDEX idx_mechanics_available
  ON mechanics (is_available)
  WHERE is_available = TRUE;

-- Mechanic rating (used in ORDER BY rating DESC)
CREATE INDEX idx_mechanics_rating
  ON mechanics (rating DESC);

-- Parts search by name (case-insensitive LIKE queries)
CREATE INDEX idx_spare_parts_name
  ON spare_parts USING GIN (to_tsvector('english', part_name));

-- Parts lookup by mechanic
CREATE INDEX idx_spare_parts_mechanic
  ON spare_parts (mechanic_id);

-- Low-stock alert check (quantity vs threshold)
CREATE INDEX idx_spare_parts_quantity
  ON spare_parts (mechanic_id, quantity, min_threshold);

-- Service requests by owner (my jobs view)
CREATE INDEX idx_requests_owner
  ON service_requests (owner_id, created_at DESC);

-- Service requests by mechanic (incoming jobs view)
CREATE INDEX idx_requests_mechanic
  ON service_requests (mechanic_id, status, created_at DESC);

-- Service requests by status (admin analytics)
CREATE INDEX idx_requests_status
  ON service_requests (status, created_at DESC);

-- Owner location for distance calcs on open requests
CREATE INDEX idx_requests_location
  ON service_requests USING GIST (owner_location);

-- Job update history per request
CREATE INDEX idx_job_updates_request
  ON job_updates (request_id, created_at ASC);

-- Audit log filtered by table (common admin query)
CREATE INDEX idx_audit_table
  ON audit_log (table_name, changed_at DESC);

-- Unresolved alerts per mechanic
CREATE INDEX idx_alerts_mechanic_unresolved
  ON alerts (mechanic_id, is_resolved)
  WHERE is_resolved = FALSE;

CREATE INDEX idx_appointments_mechanic_time
  ON appointments (mechanic_id, scheduled_for ASC);

CREATE INDEX idx_appointments_owner_time
  ON appointments (owner_id, scheduled_for ASC);

CREATE INDEX idx_chat_messages_thread
  ON chat_messages (owner_id, mechanic_id, created_at ASC);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- ------------------------------------------------------------
-- 1. Low-stock alert trigger
-- Fires after any UPDATE on spare_parts.
-- If quantity drops below min_threshold, insert into alerts.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_low_stock_alert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quantity < NEW.min_threshold AND
    (OLD.quantity >= OLD.min_threshold OR OLD.quantity IS NULL) THEN
    INSERT INTO alerts (mechanic_id, part_id, alert_type, message)
    VALUES (
      NEW.mechanic_id,
      NEW.id,
      'low_stock',
      FORMAT('Low stock: "%s" — only %s unit(s) remaining (min: %s)',
             NEW.part_name, NEW.quantity, NEW.min_threshold)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_low_stock_alert
AFTER UPDATE OF quantity ON spare_parts
FOR EACH ROW EXECUTE FUNCTION fn_low_stock_alert();

-- ------------------------------------------------------------
-- 2. Rating recalculation trigger
-- Fires after INSERT on reviews.
-- Recalculates mechanic's average rating and total_reviews count.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_update_mechanic_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE mechanics
  SET
    rating = (
      SELECT ROUND(AVG(rating)::NUMERIC, 2)
      FROM reviews
      WHERE mechanic_id = NEW.mechanic_id
    ),
    total_reviews = (
      SELECT COUNT(*) FROM reviews
      WHERE mechanic_id = NEW.mechanic_id
    ),
    updated_at = NOW()
  WHERE id = NEW.mechanic_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_mechanic_rating
AFTER INSERT ON reviews
FOR EACH ROW EXECUTE FUNCTION fn_update_mechanic_rating();

-- ------------------------------------------------------------
-- 3. Audit log trigger (service_requests + spare_parts)
-- Captures full old/new row as JSONB on every change.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (table_name, operation, old_data, new_data)
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_service_requests
AFTER INSERT OR UPDATE OR DELETE ON service_requests
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_spare_parts
AFTER INSERT OR UPDATE OR DELETE ON spare_parts
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ------------------------------------------------------------
-- 4. updated_at auto-update trigger (reusable)
-- Apply to any table that has an updated_at column.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_mechanics_updated_at
BEFORE UPDATE ON mechanics
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_parts_updated_at
BEFORE UPDATE ON spare_parts
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_requests_updated_at
BEFORE UPDATE ON service_requests
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ============================================================
-- STORED PROCEDURES
-- ============================================================

-- ------------------------------------------------------------
-- sp_accept_job
-- Called when a mechanic accepts a service request.
-- All-or-nothing: updates status, logs job_update, in one transaction.
-- ------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_accept_job(
  p_request_id  UUID,
  p_mechanic_id UUID
)
LANGUAGE plpgsql AS $$
DECLARE
  v_mechanic_user_id UUID;
BEGIN
  -- Validate mechanic exists and is available
  SELECT user_id INTO v_mechanic_user_id
  FROM mechanics
  WHERE id = p_mechanic_id AND is_available = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mechanic % not found or not available', p_mechanic_id;
  END IF;

  -- Validate request is still open
  IF NOT EXISTS (
    SELECT 1 FROM service_requests
    WHERE id = p_request_id AND status = 'requested'
  ) THEN
    RAISE EXCEPTION 'Request % is not in "requested" state', p_request_id;
  END IF;

  -- Assign mechanic and update status
  UPDATE service_requests
  SET
    mechanic_id = p_mechanic_id,
    status      = 'accepted',
    updated_at  = NOW()
  WHERE id = p_request_id;

  -- Log the status change
  INSERT INTO job_updates (request_id, status, updated_by, note)
  VALUES (p_request_id, 'accepted', v_mechanic_user_id, 'Mechanic accepted the job');

END;
$$;

-- ------------------------------------------------------------
-- sp_complete_job
-- Called when a mechanic marks a job as completed.
-- Deducts parts used, sets total cost, logs update.
-- ------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_complete_job(
  p_request_id  UUID,
  p_mechanic_id UUID,
  p_parts_used  JSONB  -- [{"part_id": "...", "qty": 2}, ...]
)
LANGUAGE plpgsql AS $$
DECLARE
  v_mechanic_user_id UUID;
  v_part             JSONB;
  v_part_id          UUID;
  v_qty              INTEGER;
  v_total            NUMERIC(10,2) := 0;
  v_part_price       NUMERIC(10,2);
BEGIN
  SELECT user_id INTO v_mechanic_user_id
  FROM mechanics WHERE id = p_mechanic_id;

  -- Validate request is in progress
  IF NOT EXISTS (
    SELECT 1 FROM service_requests
    WHERE id = p_request_id
      AND mechanic_id = p_mechanic_id
      AND status = 'in_progress'
  ) THEN
    RAISE EXCEPTION 'Request % is not in_progress for mechanic %', p_request_id, p_mechanic_id;
  END IF;

  -- Deduct each part and accumulate cost
  FOR v_part IN SELECT * FROM jsonb_array_elements(p_parts_used)
  LOOP
    v_part_id := (v_part->>'part_id')::UUID;
    v_qty     := (v_part->>'qty')::INTEGER;

    SELECT price INTO v_part_price
    FROM spare_parts WHERE id = v_part_id;

    -- Deduct quantity (triggers low-stock alert if needed)
    UPDATE spare_parts
    SET quantity = quantity - v_qty
    WHERE id = v_part_id AND mechanic_id = p_mechanic_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Part % not found in mechanic inventory', v_part_id;
    END IF;

    INSERT INTO service_request_parts (request_id, part_id, quantity_used, unit_price)
    VALUES (p_request_id, v_part_id, v_qty, v_part_price)
    ON CONFLICT (request_id, part_id) DO UPDATE
      SET quantity_used = EXCLUDED.quantity_used;

    v_total := v_total + (v_part_price * v_qty);
  END LOOP;

  -- Mark job complete
  UPDATE service_requests
  SET status = 'completed', total_cost = v_total, updated_at = NOW()
  WHERE id = p_request_id;

  INSERT INTO job_updates (request_id, status, updated_by, note)
  VALUES (p_request_id, 'completed', v_mechanic_user_id,
          FORMAT('Job completed. Total cost: $%s', v_total));

END;
$$;

-- ============================================================
-- VIEWS & MATERIALIZED VIEWS
-- ============================================================

-- ------------------------------------------------------------
-- Mechanic dashboard summary (materialized — refresh after each job)
-- ------------------------------------------------------------
CREATE MATERIALIZED VIEW mv_mechanic_dashboard AS
SELECT
  m.id                                    AS mechanic_id,
  u.name                                  AS mechanic_name,
  m.rating,
  m.total_reviews,
  COUNT(sr.id)                            AS total_jobs,
  COUNT(sr.id) FILTER (WHERE sr.status = 'completed')    AS completed_jobs,
  COUNT(sr.id) FILTER (WHERE sr.status = 'in_progress')  AS active_jobs,
  COALESCE(SUM(sr.total_cost) FILTER (WHERE sr.status = 'completed'), 0) AS total_earnings,
  COALESCE(SUM(sr.total_cost) FILTER (
    WHERE sr.status = 'completed'
      AND sr.updated_at >= date_trunc('week', NOW())
  ), 0)                                   AS earnings_this_week
FROM mechanics m
JOIN users u ON u.id = m.user_id
LEFT JOIN service_requests sr ON sr.mechanic_id = m.id
GROUP BY m.id, u.name, m.rating, m.total_reviews;

CREATE UNIQUE INDEX ON mv_mechanic_dashboard (mechanic_id);

-- Refresh command (call this after job completion):
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mechanic_dashboard;

-- ------------------------------------------------------------
-- Nearby mechanics search view (non-materialized — real-time)
-- Usage: SELECT * FROM v_mechanics_search WHERE is_available = TRUE;
-- Then apply ST_DWithin filter in the query.
-- ------------------------------------------------------------
CREATE VIEW v_mechanics_search AS
SELECT
  m.id,
  m.user_id,
  u.name,
  u.phone,
  m.location,
  m.specialization,
  m.vehicle_types,
  m.is_available,
  m.rating,
  m.total_reviews,
  m.address
FROM mechanics m
JOIN users u ON u.id = m.user_id
WHERE u.is_active = TRUE;

-- ------------------------------------------------------------
-- Platform analytics view (for admin)
-- ------------------------------------------------------------
CREATE VIEW v_admin_analytics AS
SELECT
  COUNT(*)                                            AS total_requests,
  COUNT(*) FILTER (WHERE status = 'completed')        AS completed,
  COUNT(*) FILTER (WHERE status = 'cancelled')        AS cancelled,
  COUNT(*) FILTER (WHERE status IN ('requested','accepted','in_progress')) AS active,
  COALESCE(SUM(total_cost) FILTER (WHERE status = 'completed'), 0) AS total_revenue,
  ROUND(AVG(total_cost) FILTER (WHERE status = 'completed'), 2) AS avg_job_value,
  date_trunc('hour', created_at) AS hour_bucket
FROM service_requests
GROUP BY date_trunc('hour', created_at);

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================

ALTER TABLE spare_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Mechanics can only see/edit their own parts
CREATE POLICY mechanic_own_parts ON spare_parts
  USING (
    mechanic_id = (
      SELECT id FROM mechanics WHERE user_id = current_setting('app.current_user_id')::UUID
    )
  );

-- Mechanics can only see their own alerts
CREATE POLICY mechanic_own_alerts ON alerts
  USING (
    mechanic_id = (
      SELECT id FROM mechanics WHERE user_id = current_setting('app.current_user_id')::UUID
    )
  );

-- Owners see only their own requests; mechanics see requests assigned to them
CREATE POLICY request_visibility ON service_requests
  USING (
    owner_id = current_setting('app.current_user_id')::UUID
    OR mechanic_id = (
      SELECT id FROM mechanics
      WHERE user_id = current_setting('app.current_user_id')::UUID
    )
  );

-- ============================================================
-- SAMPLE GEOSPATIAL QUERY (reference)
-- Find all available mechanics within 10 km of a given point.
-- ============================================================

-- SELECT
--   m.id,
--   u.name,
--   m.rating,
--   ROUND(ST_Distance(m.location, ST_MakePoint(:lng, :lat)::GEOGRAPHY) / 1000, 2) AS distance_km
-- FROM v_mechanics_search m
-- JOIN users u ON u.id = m.user_id
-- WHERE
--   m.is_available = TRUE
--   AND ST_DWithin(m.location, ST_MakePoint(:lng, :lat)::GEOGRAPHY, 10000)
-- ORDER BY distance_km ASC, m.rating DESC;
