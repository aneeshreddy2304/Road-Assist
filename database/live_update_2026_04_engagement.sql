DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
    CREATE TYPE appointment_status AS ENUM ('requested', 'confirmed', 'completed', 'cancelled');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chat_sender_role') THEN
    CREATE TYPE chat_sender_role AS ENUM ('owner', 'mechanic');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mechanic_id UUID NOT NULL REFERENCES mechanics(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  service_type VARCHAR(120) NOT NULL,
  notes TEXT,
  status appointment_status NOT NULL DEFAULT 'requested',
  estimated_cost NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mechanic_id UUID NOT NULL REFERENCES mechanics(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_role chat_sender_role NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_mechanic_time
  ON appointments (mechanic_id, scheduled_for ASC);

CREATE INDEX IF NOT EXISTS idx_appointments_owner_time
  ON appointments (owner_id, scheduled_for ASC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread
  ON chat_messages (owner_id, mechanic_id, created_at ASC);
