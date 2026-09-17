-- Vehicle Care: owner maintenance history, reminders, and protected invoices.
-- This mirrors the idempotent runtime installer in app/core/bootstrap.py.

CREATE TABLE IF NOT EXISTS vehicle_quick_notes (
  id UUID PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicle_checkins (
  id UUID PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recorded_on DATE NOT NULL DEFAULT CURRENT_DATE,
  odometer_miles INTEGER NOT NULL CHECK (odometer_miles >= 0),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicle_service_records (
  id UUID PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_date DATE NOT NULL,
  odometer_miles INTEGER NOT NULL CHECK (odometer_miles >= 0),
  provider_name VARCHAR(160) NOT NULL,
  total_cost NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (total_cost >= 0),
  notes TEXT,
  invoice_filename VARCHAR(255),
  invoice_storage_key VARCHAR(255),
  invoice_content_type VARCHAR(100),
  next_due_date DATE,
  next_due_miles INTEGER CHECK (next_due_miles IS NULL OR next_due_miles >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicle_service_record_items (
  id UUID PRIMARY KEY,
  service_record_id UUID NOT NULL REFERENCES vehicle_service_records(id) ON DELETE CASCADE,
  description VARCHAR(240) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicle_care_reminders (
  id UUID PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_service_record_id UUID REFERENCES vehicle_service_records(id) ON DELETE CASCADE,
  reminder_type VARCHAR(32) NOT NULL CHECK (reminder_type IN ('monthly_checkin', 'service_due')),
  reference_month DATE,
  due_at TIMESTAMPTZ NOT NULL,
  target_date DATE,
  target_miles INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  resolved_at TIMESTAMPTZ,
  resolved_by_service_record_id UUID REFERENCES vehicle_service_records(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS owner_notifications (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  reminder_id UUID REFERENCES vehicle_care_reminders(id) ON DELETE CASCADE,
  kind VARCHAR(40) NOT NULL,
  title VARCHAR(180) NOT NULL,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_checkins_owner_vehicle ON vehicle_checkins (owner_id, vehicle_id, recorded_on DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_quick_notes_owner_vehicle ON vehicle_quick_notes (owner_id, vehicle_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_service_records_owner_vehicle ON vehicle_service_records (owner_id, vehicle_id, service_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_care_reminders_owner_status ON vehicle_care_reminders (owner_id, status, due_at DESC);
CREATE INDEX IF NOT EXISTS idx_owner_notifications_owner ON owner_notifications (owner_id, completed_at, read_at, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicle_care_monthly_reminder ON vehicle_care_reminders (owner_id, vehicle_id, reminder_type, reference_month) WHERE reminder_type = 'monthly_checkin';
CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicle_care_service_reminder ON vehicle_care_reminders (vehicle_id, source_service_record_id, reminder_type) WHERE reminder_type = 'service_due';
