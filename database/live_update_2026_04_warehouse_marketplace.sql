DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'warehouse'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'warehouse';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'warehouse_order_status') THEN
    CREATE TYPE warehouse_order_status AS ENUM ('requested', 'quoted', 'confirmed', 'packed', 'delivered', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'warehouse_chat_sender_role') THEN
    CREATE TYPE warehouse_chat_sender_role AS ENUM ('mechanic', 'warehouse');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  address VARCHAR(255) NOT NULL,
  lat NUMERIC(9, 6) NOT NULL,
  lng NUMERIC(9, 6) NOT NULL,
  contact_phone VARCHAR(30),
  description TEXT,
  fulfillment_hours VARCHAR(120),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouse_parts (
  id UUID PRIMARY KEY,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  part_name VARCHAR(120) NOT NULL,
  part_number VARCHAR(80),
  quantity INTEGER NOT NULL DEFAULT 0,
  min_threshold INTEGER NOT NULL DEFAULT 2,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  compatible_vehicles vehicle_type[] NOT NULL DEFAULT '{}',
  manufacturer VARCHAR(120),
  lead_time_label VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouse_orders (
  id UUID PRIMARY KEY,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  mechanic_id UUID NOT NULL REFERENCES mechanics(id) ON DELETE CASCADE,
  warehouse_part_id UUID REFERENCES warehouse_parts(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  status warehouse_order_status NOT NULL DEFAULT 'requested',
  unit_price NUMERIC(10, 2),
  total_price NUMERIC(10, 2),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouse_messages (
  id UUID PRIMARY KEY,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  mechanic_id UUID NOT NULL REFERENCES mechanics(id) ON DELETE CASCADE,
  warehouse_order_id UUID REFERENCES warehouse_orders(id) ON DELETE SET NULL,
  sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_role warehouse_chat_sender_role NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_warehouse_parts_lookup
  ON warehouse_parts (warehouse_id, quantity, part_name);

CREATE INDEX IF NOT EXISTS idx_warehouse_orders_lookup
  ON warehouse_orders (warehouse_id, mechanic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_warehouse_messages_thread
  ON warehouse_messages (warehouse_id, mechanic_id, created_at ASC);
