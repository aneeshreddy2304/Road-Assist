from sqlalchemy import text

from app.db.session import engine

WAREHOUSE_DEMO_PASSWORD_HASH = "$2b$12$n3XpKloeMVDKDCQv6lIt/.YuevmuXiT6l.ugq1UKzb.NgtKPAoBbe"

WAREHOUSE_USERS_SEED_SQL = f"""
INSERT INTO users (id, name, email, password_hash, phone, role, is_active, created_at, updated_at)
VALUES
  ('8ddf8c31-67fa-4cae-b45a-4c66985cbf01', 'Blue Ridge Auto Supply', 'warehouse1@roadassist.in', '{WAREHOUSE_DEMO_PASSWORD_HASH}', '+1-804-555-4001', 'warehouse', TRUE, NOW(), NOW()),
  ('12f974b4-ff1e-4f4e-8cf7-315d3eb92e02', 'James River Parts Hub', 'warehouse2@roadassist.in', '{WAREHOUSE_DEMO_PASSWORD_HASH}', '+1-804-555-4002', 'warehouse', TRUE, NOW(), NOW()),
  ('fd00d65a-d3e9-4b07-a28a-f95d9dcb2d03', 'River City EV Components', 'warehouse3@roadassist.in', '{WAREHOUSE_DEMO_PASSWORD_HASH}', '+1-804-555-4003', 'warehouse', TRUE, NOW(), NOW()),
  ('a6b1b6c4-26bf-4cb0-bef7-35df56d1c104', 'Broad Street Brake Depot', 'warehouse4@roadassist.in', '{WAREHOUSE_DEMO_PASSWORD_HASH}', '+1-804-555-4004', 'warehouse', TRUE, NOW(), NOW()),
  ('d7c2f5bf-e5d0-4aaf-8f08-8d3bfa93af05', 'Capital Fleet Warehouse', 'warehouse5@roadassist.in', '{WAREHOUSE_DEMO_PASSWORD_HASH}', '+1-804-555-4005', 'warehouse', TRUE, NOW(), NOW()),
  ('73ddb614-9037-453b-817f-bc1f182acd06', 'Southside Rapid Spares', 'warehouse6@roadassist.in', '{WAREHOUSE_DEMO_PASSWORD_HASH}', '+1-804-555-4006', 'warehouse', TRUE, NOW(), NOW())
ON CONFLICT (email) DO UPDATE
SET
  name = EXCLUDED.name,
  password_hash = EXCLUDED.password_hash,
  phone = EXCLUDED.phone,
  role = EXCLUDED.role,
  is_active = TRUE,
  updated_at = NOW();
"""

WAREHOUSE_PROFILES_SEED_SQL = """
INSERT INTO warehouses (id, user_id, name, address, lat, lng, contact_phone, description, fulfillment_hours, approval_status, is_active, created_at, updated_at)
VALUES
  ('d4d4af8e-18ef-4e1c-a6f5-f1f8cd620101', '8ddf8c31-67fa-4cae-b45a-4c66985cbf01', 'Blue Ridge Auto Supply', '2601 W Broad St, Richmond, VA', 37.553200, -77.474900, '+1-804-555-4001', 'Downtown-ready general parts supplier with high-turn stock for emergency roadside jobs.', 'Mon-Sat 07:00 AM - 09:00 PM', 'approved', TRUE, NOW(), NOW()),
  ('e790a310-444e-4cb0-8820-912ece580102', '12f974b4-ff1e-4f4e-8cf7-315d3eb92e02', 'James River Parts Hub', '1201 Hull St, Richmond, VA', 37.526100, -77.445500, '+1-804-555-4002', 'Balanced mixed inventory with filters, cooling, lighting, and driveline essentials.', 'Daily 08:00 AM - 08:00 PM', 'approved', TRUE, NOW(), NOW()),
  ('af0d2cb6-0b13-48bd-921e-835064c70103', 'fd00d65a-d3e9-4b07-a28a-f95d9dcb2d03', 'River City EV Components', '4801 W Broad St, Richmond, VA', 37.582500, -77.498400, '+1-804-555-4003', 'EV-focused warehouse with batteries, charging accessories, sensors, and modules.', 'Mon-Fri 08:00 AM - 07:00 PM', 'approved', TRUE, NOW(), NOW()),
  ('af93aa5c-eb9d-4ff4-8aef-3c96c9ad0104', 'a6b1b6c4-26bf-4cb0-bef7-35df56d1c104', 'Broad Street Brake Depot', '3301 W Broad St, Richmond, VA', 37.558100, -77.482800, '+1-804-555-4004', 'Pads, rotors, calipers, and brake fluids kept deep for same-day mechanic pickup.', 'Daily 07:30 AM - 09:30 PM', 'approved', TRUE, NOW(), NOW()),
  ('8f9f75cb-aaf9-4a68-97d3-331a1b230105', 'd7c2f5bf-e5d0-4aaf-8f08-8d3bfa93af05', 'Capital Fleet Warehouse', '6400 Midlothian Tpke, Richmond, VA', 37.503900, -77.517100, '+1-804-555-4005', 'Fleet and commercial stock for vans, SUVs, and light trucks.', 'Mon-Sat 06:00 AM - 10:00 PM', 'approved', TRUE, NOW(), NOW()),
  ('bbcbdd48-cd16-4a72-83f5-ff5fd2530106', '73ddb614-9037-453b-817f-bc1f182acd06', 'Southside Rapid Spares', '4700 Forest Hill Ave, Richmond, VA', 37.517100, -77.503500, '+1-804-555-4006', 'Fast-moving emergency stock with batteries, bulbs, ignition, and starter components.', 'Daily 24/7 emergency desk', 'approved', TRUE, NOW(), NOW())
ON CONFLICT (user_id) DO UPDATE
SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  contact_phone = EXCLUDED.contact_phone,
  description = EXCLUDED.description,
  fulfillment_hours = EXCLUDED.fulfillment_hours,
  approval_status = 'approved',
  is_active = TRUE,
  updated_at = NOW();
"""

WAREHOUSE_PARTS_SEED_SQL = """
INSERT INTO warehouse_parts (id, warehouse_id, part_name, part_number, quantity, min_threshold, price, compatible_vehicles, manufacturer, lead_time_label, created_at, updated_at)
VALUES
  ('a8001001-1111-4b8d-81d1-000000000001', 'd4d4af8e-18ef-4e1c-a6f5-f1f8cd620101', '12V AGM Battery', 'BAT-AGM-47', 24, 6, 189.00, '{car,suv}', 'Interstate', 'Pickup in 20 min', NOW(), NOW()),
  ('a8001001-1111-4b8d-81d1-000000000002', 'd4d4af8e-18ef-4e1c-a6f5-f1f8cd620101', 'Starter Motor', 'STM-2.0-RCH', 8, 2, 249.00, '{car,suv}', 'Bosch', 'Pickup in 35 min', NOW(), NOW()),
  ('a8001001-1111-4b8d-81d1-000000000003', 'd4d4af8e-18ef-4e1c-a6f5-f1f8cd620101', 'Alternator Belt', 'ALT-BELT-620', 18, 4, 38.50, '{car,suv,truck}', 'Gates', 'Ready now', NOW(), NOW()),
  ('a8001001-1111-4b8d-81d1-000000000004', 'd4d4af8e-18ef-4e1c-a6f5-f1f8cd620101', 'Radiator Coolant 1 Gal', 'COOL-50-1G', 32, 8, 22.00, '{car,suv,truck}', 'Peak', 'Ready now', NOW(), NOW()),

  ('a8001001-1111-4b8d-81d1-000000000005', 'e790a310-444e-4cb0-8820-912ece580102', 'Oil Filter', 'OF-5W-201', 44, 10, 11.25, '{car,suv}', 'Mobil', 'Ready now', NOW(), NOW()),
  ('a8001001-1111-4b8d-81d1-000000000006', 'e790a310-444e-4cb0-8820-912ece580102', 'Engine Air Filter', 'AF-INT-443', 27, 6, 19.75, '{car,suv}', 'Mann', 'Pickup in 15 min', NOW(), NOW()),
  ('a8001001-1111-4b8d-81d1-000000000007', 'e790a310-444e-4cb0-8820-912ece580102', 'Cabin Air Filter', 'CAF-1138', 31, 6, 17.40, '{car,suv}', 'Fram', 'Pickup in 15 min', NOW(), NOW()),
  ('a8001001-1111-4b8d-81d1-000000000008', 'e790a310-444e-4cb0-8820-912ece580102', 'Oxygen Sensor', 'O2-RVA-88', 11, 3, 94.00, '{car,suv}', 'Denso', 'Pickup in 30 min', NOW(), NOW()),

  ('a8001001-1111-4b8d-81d1-000000000009', 'af0d2cb6-0b13-48bd-921e-835064c70103', 'Portable EV Charger Cable', 'EVSE-L2-25', 16, 4, 219.00, '{car,suv}', 'Lectron', 'Pickup in 25 min', NOW(), NOW()),
  ('a8001001-1111-4b8d-81d1-000000000010', 'af0d2cb6-0b13-48bd-921e-835064c70103', '12V Auxiliary Battery', 'EV-AUX-12V', 12, 3, 169.00, '{car,suv}', 'Aptiv', 'Pickup in 45 min', NOW(), NOW()),
  ('a8001001-1111-4b8d-81d1-000000000011', 'af0d2cb6-0b13-48bd-921e-835064c70103', 'Wheel Speed Sensor', 'EV-WSS-204', 20, 5, 73.25, '{car,suv}', 'Continental', 'Ready now', NOW(), NOW()),
  ('a8001001-1111-4b8d-81d1-000000000012', 'af0d2cb6-0b13-48bd-921e-835064c70103', 'DC-DC Converter Fuse Kit', 'EV-FUSE-14', 9, 2, 58.00, '{car,suv}', 'Littelfuse', 'Pickup in 20 min', NOW(), NOW()),

  ('a8001001-1111-4b8d-81d1-000000000013', 'af93aa5c-eb9d-4ff4-8aef-3c96c9ad0104', 'Front Brake Pad Set', 'BRK-PAD-F32', 36, 8, 64.00, '{car,suv}', 'Akebono', 'Ready now', NOW(), NOW()),
  ('a8001001-1111-4b8d-81d1-000000000014', 'af93aa5c-eb9d-4ff4-8aef-3c96c9ad0104', 'Rear Brake Rotor', 'BRK-ROT-R19', 14, 4, 89.50, '{car,suv}', 'Brembo', 'Pickup in 25 min', NOW(), NOW()),
  ('a8001001-1111-4b8d-81d1-000000000015', 'af93aa5c-eb9d-4ff4-8aef-3c96c9ad0104', 'Brake Fluid DOT 4', 'DOT4-32OZ', 40, 10, 13.75, '{car,suv,truck,bike}', 'Prestone', 'Ready now', NOW(), NOW()),
  ('a8001001-1111-4b8d-81d1-000000000016', 'af93aa5c-eb9d-4ff4-8aef-3c96c9ad0104', 'Front Caliper Assembly', 'CAL-FRT-22', 7, 2, 129.00, '{car,suv}', 'Raybestos', 'Pickup in 35 min', NOW(), NOW()),

  ('a8001001-1111-4b8d-81d1-000000000017', '8f9f75cb-aaf9-4a68-97d3-331a1b230105', 'Heavy Duty Radiator Hose', 'HDR-HOSE-88', 18, 5, 41.20, '{truck,suv}', 'Dayco', 'Pickup in 30 min', NOW(), NOW()),
  ('a8001001-1111-4b8d-81d1-000000000018', '8f9f75cb-aaf9-4a68-97d3-331a1b230105', 'Fleet Oil Filter', 'FLT-OF-700', 28, 8, 16.30, '{truck,suv}', 'Fleetguard', 'Ready now', NOW(), NOW()),
  ('a8001001-1111-4b8d-81d1-000000000019', '8f9f75cb-aaf9-4a68-97d3-331a1b230105', 'Serpentine Belt HD', 'HD-BELT-91', 12, 3, 47.80, '{truck,suv}', 'Continental', 'Pickup in 20 min', NOW(), NOW()),
  ('a8001001-1111-4b8d-81d1-000000000020', '8f9f75cb-aaf9-4a68-97d3-331a1b230105', 'LED Work Lamp', 'WRK-LAMP-9', 22, 5, 35.00, '{truck,suv}', 'Philips', 'Ready now', NOW(), NOW()),

  ('a8001001-1111-4b8d-81d1-000000000021', 'bbcbdd48-cd16-4a72-83f5-ff5fd2530106', 'Ignition Coil', 'IGN-COIL-12', 15, 4, 78.25, '{car,suv}', 'Denso', 'Pickup in 20 min', NOW(), NOW()),
  ('a8001001-1111-4b8d-81d1-000000000022', 'bbcbdd48-cd16-4a72-83f5-ff5fd2530106', 'Spark Plug Set', 'SPK-SET-4', 26, 6, 29.90, '{car,suv,bike}', 'NGK', 'Ready now', NOW(), NOW()),
  ('a8001001-1111-4b8d-81d1-000000000023', 'bbcbdd48-cd16-4a72-83f5-ff5fd2530106', 'Headlight Bulb H11', 'BULB-H11', 34, 8, 18.40, '{car,suv,truck}', 'Sylvania', 'Ready now', NOW(), NOW()),
  ('a8001001-1111-4b8d-81d1-000000000024', 'bbcbdd48-cd16-4a72-83f5-ff5fd2530106', 'Starter Relay', 'RELAY-STR-8', 13, 3, 21.60, '{car,suv,bike}', 'Omron', 'Pickup in 15 min', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
"""


async def ensure_schema_updates() -> None:
    async with engine.begin() as conn:
        await conn.execute(
            text(
                """
                DO $$
                BEGIN
                  IF EXISTS (
                    SELECT 1 FROM pg_type t
                    JOIN pg_enum e ON t.oid = e.enumtypid
                    WHERE t.typname = 'user_role' AND e.enumlabel = 'warehouse'
                  ) THEN
                    RETURN;
                  END IF;
                  ALTER TYPE user_role ADD VALUE 'warehouse';
                END $$;
                """
            )
        )

    async with engine.begin() as conn:
        await conn.execute(
            text(
                """
                ALTER TABLE mechanics
                ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'approved'
                """
            )
        )
        await conn.execute(
            text(
                """
                UPDATE mechanics
                SET approval_status = 'approved'
                WHERE approval_status IS NULL
                """
            )
        )
        await conn.execute(
            text(
                """
                DO $$
                BEGIN
                  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'warehouse_order_status') THEN
                    CREATE TYPE warehouse_order_status AS ENUM ('requested', 'quoted', 'confirmed', 'packed', 'delivered', 'cancelled');
                  END IF;
                  IF NOT EXISTS (
                    SELECT 1 FROM pg_type t
                    JOIN pg_enum e ON t.oid = e.enumtypid
                    WHERE t.typname = 'warehouse_order_status' AND e.enumlabel = 'accepted'
                  ) THEN
                    ALTER TYPE warehouse_order_status ADD VALUE 'accepted';
                  END IF;
                  IF NOT EXISTS (
                    SELECT 1 FROM pg_type t
                    JOIN pg_enum e ON t.oid = e.enumtypid
                    WHERE t.typname = 'warehouse_order_status' AND e.enumlabel = 'awaiting_shipping'
                  ) THEN
                    ALTER TYPE warehouse_order_status ADD VALUE 'awaiting_shipping';
                  END IF;
                  IF NOT EXISTS (
                    SELECT 1 FROM pg_type t
                    JOIN pg_enum e ON t.oid = e.enumtypid
                    WHERE t.typname = 'warehouse_order_status' AND e.enumlabel = 'shipped'
                  ) THEN
                    ALTER TYPE warehouse_order_status ADD VALUE 'shipped';
                  END IF;
                  IF NOT EXISTS (
                    SELECT 1 FROM pg_type t
                    JOIN pg_enum e ON t.oid = e.enumtypid
                    WHERE t.typname = 'warehouse_order_status' AND e.enumlabel = 'out_for_delivery'
                  ) THEN
                    ALTER TYPE warehouse_order_status ADD VALUE 'out_for_delivery';
                  END IF;
                  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'warehouse_chat_sender_role') THEN
                    CREATE TYPE warehouse_chat_sender_role AS ENUM ('mechanic', 'warehouse');
                  END IF;
                END $$;
                """
            )
        )
        await conn.execute(
            text(
                """
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
                  approval_status VARCHAR(20) NOT NULL DEFAULT 'approved',
                  is_active BOOLEAN NOT NULL DEFAULT TRUE,
                  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
        )
        await conn.execute(
            text(
                """
                ALTER TABLE warehouses
                ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(30)
                """
            )
        )
        await conn.execute(
            text(
                """
                ALTER TABLE warehouses
                ADD COLUMN IF NOT EXISTS description TEXT
                """
            )
        )
        await conn.execute(
            text(
                """
                ALTER TABLE warehouses
                ADD COLUMN IF NOT EXISTS fulfillment_hours VARCHAR(120)
                """
            )
        )
        await conn.execute(
            text(
                """
                ALTER TABLE warehouses
                ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'approved'
                """
            )
        )
        await conn.execute(
            text(
                """
                UPDATE warehouses
                SET approval_status = 'approved'
                WHERE approval_status IS NULL
                """
            )
        )
        await conn.execute(
            text(
                """
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
                )
                """
            )
        )
        await conn.execute(text("ALTER TABLE warehouse_parts ADD COLUMN IF NOT EXISTS compatible_vehicles vehicle_type[] NOT NULL DEFAULT '{}'"))
        await conn.execute(text("ALTER TABLE warehouse_parts ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(120)"))
        await conn.execute(text("ALTER TABLE warehouse_parts ADD COLUMN IF NOT EXISTS lead_time_label VARCHAR(120)"))
        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS warehouse_orders (
                  id UUID PRIMARY KEY,
                  order_ref VARCHAR(32),
                  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
                  mechanic_id UUID NOT NULL REFERENCES mechanics(id) ON DELETE CASCADE,
                  warehouse_part_id UUID REFERENCES warehouse_parts(id) ON DELETE SET NULL,
                  quantity INTEGER NOT NULL DEFAULT 1,
                  status warehouse_order_status NOT NULL DEFAULT 'requested',
                  unit_price NUMERIC(10, 2),
                  total_price NUMERIC(10, 2),
                  note TEXT,
                  inventory_deducted BOOLEAN NOT NULL DEFAULT FALSE,
                  inventory_received BOOLEAN NOT NULL DEFAULT FALSE,
                  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
        )
        await conn.execute(text("ALTER TABLE warehouse_orders ADD COLUMN IF NOT EXISTS order_ref VARCHAR(32)"))
        await conn.execute(text("ALTER TABLE warehouse_orders ADD COLUMN IF NOT EXISTS inventory_deducted BOOLEAN NOT NULL DEFAULT FALSE"))
        await conn.execute(text("ALTER TABLE warehouse_orders ADD COLUMN IF NOT EXISTS inventory_received BOOLEAN NOT NULL DEFAULT FALSE"))
        await conn.execute(text("UPDATE warehouse_orders SET order_ref = 'WO-' || UPPER(SUBSTRING(id::text, 1, 8)) WHERE order_ref IS NULL"))
        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS warehouse_messages (
                  id UUID PRIMARY KEY,
                  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
                  mechanic_id UUID NOT NULL REFERENCES mechanics(id) ON DELETE CASCADE,
                  warehouse_order_id UUID REFERENCES warehouse_orders(id) ON DELETE SET NULL,
                  sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                  sender_role warehouse_chat_sender_role NOT NULL,
                  message TEXT NOT NULL,
                  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
        )
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_warehouse_parts_lookup ON warehouse_parts (warehouse_id, quantity, part_name)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_warehouse_orders_lookup ON warehouse_orders (warehouse_id, mechanic_id, created_at DESC)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_warehouse_orders_ref ON warehouse_orders (order_ref, created_at DESC)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_warehouse_messages_thread ON warehouse_messages (warehouse_id, mechanic_id, created_at ASC)"))
        await conn.execute(text(WAREHOUSE_USERS_SEED_SQL))
        await conn.execute(text(WAREHOUSE_PROFILES_SEED_SQL))
        await conn.execute(text(WAREHOUSE_PARTS_SEED_SQL))


async def ensure_vehicle_care_schema() -> None:
    """Install the owner Vehicle Care tables with idempotent, production-safe DDL."""
    async with engine.begin() as conn:
        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS vehicle_quick_notes (
                  id UUID PRIMARY KEY,
                  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
                  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                  note TEXT NOT NULL,
                  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
        )
        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS vehicle_checkins (
                  id UUID PRIMARY KEY,
                  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
                  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                  recorded_on DATE NOT NULL DEFAULT CURRENT_DATE,
                  odometer_miles INTEGER NOT NULL CHECK (odometer_miles >= 0),
                  note TEXT,
                  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
        )
        await conn.execute(
            text(
                """
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
                )
                """
            )
        )
        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS vehicle_service_record_items (
                  id UUID PRIMARY KEY,
                  service_record_id UUID NOT NULL REFERENCES vehicle_service_records(id) ON DELETE CASCADE,
                  description VARCHAR(240) NOT NULL,
                  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
        )
        await conn.execute(
            text(
                """
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
                )
                """
            )
        )
        await conn.execute(
            text(
                """
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
                )
                """
            )
        )
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_vehicle_checkins_owner_vehicle ON vehicle_checkins (owner_id, vehicle_id, recorded_on DESC, created_at DESC)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_vehicle_quick_notes_owner_vehicle ON vehicle_quick_notes (owner_id, vehicle_id, created_at DESC)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_vehicle_service_records_owner_vehicle ON vehicle_service_records (owner_id, vehicle_id, service_date DESC, created_at DESC)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_vehicle_care_reminders_owner_status ON vehicle_care_reminders (owner_id, status, due_at DESC)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_owner_notifications_owner ON owner_notifications (owner_id, completed_at, read_at, created_at DESC)"))
        await conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicle_care_monthly_reminder ON vehicle_care_reminders (owner_id, vehicle_id, reminder_type, reference_month) WHERE reminder_type = 'monthly_checkin'"))
        await conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicle_care_service_reminder ON vehicle_care_reminders (vehicle_id, source_service_record_id, reminder_type) WHERE reminder_type = 'service_due'"))


async def ensure_owner_marketplace_schema() -> None:
    """Install the owner directory and direct-to-owner parts ordering tables.

    This is intentionally separate from the mechanic-to-warehouse workflow:
    owners browse California businesses and fixed-price consumer products, while
    mechanics keep their existing wholesale warehouse tools.
    """
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS owner_directory_providers (
              id UUID PRIMARY KEY,
              external_key VARCHAR(120) UNIQUE NOT NULL,
              name VARCHAR(180) NOT NULL,
              category VARCHAR(32) NOT NULL CHECK (category IN ('repair', 'dealership', 'tire', 'towing', 'parts')),
              city VARCHAR(100) NOT NULL,
              state CHAR(2) NOT NULL DEFAULT 'CA',
              address TEXT NOT NULL,
              location GEOGRAPHY(POINT, 4326) NOT NULL,
              services TEXT[] NOT NULL DEFAULT '{}',
              service_modes TEXT[] NOT NULL DEFAULT '{}',
              can_schedule BOOLEAN NOT NULL DEFAULT FALSE,
              description TEXT,
              synthetic_phone VARCHAR(40) NOT NULL,
              synthetic_email VARCHAR(180) NOT NULL,
              website_url TEXT,
              is_active BOOLEAN NOT NULL DEFAULT TRUE,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS owner_part_products (
              id UUID PRIMARY KEY,
              provider_id UUID NOT NULL REFERENCES owner_directory_providers(id) ON DELETE CASCADE,
              name VARCHAR(180) NOT NULL,
              brand VARCHAR(100),
              category VARCHAR(60) NOT NULL,
              price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
              stock_count INTEGER NOT NULL DEFAULT 0 CHECK (stock_count >= 0),
              description TEXT,
              is_active BOOLEAN NOT NULL DEFAULT TRUE,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS owner_part_orders (
              id UUID PRIMARY KEY,
              order_ref VARCHAR(30) UNIQUE NOT NULL,
              owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              product_id UUID NOT NULL REFERENCES owner_part_products(id) ON DELETE RESTRICT,
              quantity INTEGER NOT NULL CHECK (quantity > 0),
              unit_price NUMERIC(10,2) NOT NULL,
              total_price NUMERIC(10,2) NOT NULL,
              delivery_name VARCHAR(120) NOT NULL,
              delivery_address TEXT NOT NULL,
              delivery_phone VARCHAR(40) NOT NULL,
              delivery_notes TEXT,
              status VARCHAR(32) NOT NULL DEFAULT 'confirmed',
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS owner_provider_appointments (
              id UUID PRIMARY KEY,
              owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              provider_id UUID NOT NULL REFERENCES owner_directory_providers(id) ON DELETE RESTRICT,
              vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
              requested_for TIMESTAMPTZ NOT NULL,
              service_type VARCHAR(160) NOT NULL,
              notes TEXT,
              status VARCHAR(32) NOT NULL DEFAULT 'requested',
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_owner_directory_location ON owner_directory_providers USING GIST(location)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_owner_directory_category ON owner_directory_providers(category, city)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_owner_parts_provider ON owner_part_products(provider_id, category)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_owner_part_orders_owner ON owner_part_orders(owner_id, created_at DESC)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_owner_provider_appointments_owner ON owner_provider_appointments(owner_id, requested_for ASC)"))
        await conn.execute(text("""
          INSERT INTO owner_directory_providers
            (id, external_key, name, category, city, address, location, services, service_modes, can_schedule, description, synthetic_phone, synthetic_email, website_url)
          VALUES
            ('b4e18cfa-3a10-4d01-9981-000000000001', 'firestone-la-west', 'Firestone Complete Auto Care', 'tire', 'Los Angeles', '10785 Santa Monica Blvd, Los Angeles, CA 90025', ST_SetSRID(ST_MakePoint(-118.4310, 34.0450),4326)::geography, ARRAY['Tires','Oil change','Wheel alignment','Brake service','Flat repair'], ARRAY['shop'], TRUE, 'Service appointments and tire care in Los Angeles.', '+1 (555) 010-2101', 'firestone-la-west@wingman-demo.example', 'https://www.firestonecompleteautocare.com/california/los-angeles/10785-santa-monica-blvd/'),
            ('b4e18cfa-3a10-4d01-9981-000000000002', 'autozone-la-washington', 'AutoZone', 'parts', 'Los Angeles', '1325 W Washington Blvd, Los Angeles, CA 90007', ST_SetSRID(ST_MakePoint(-118.2833, 34.0397),4326)::geography, ARRAY['Batteries','Brakes','Wipers','Oil and filters','Loan-A-Tool'], ARRAY['parts'], FALSE, 'Consumer maintenance supplies and vehicle parts.', '+1 (555) 010-2102', 'autozone-la@wingman-demo.example', 'https://www.autozone.com/locations/ca/los-angeles/1325-w-washington-blvd'),
            ('b4e18cfa-3a10-4d01-9981-000000000003', 'bmw-sf', 'BMW of San Francisco', 'dealership', 'San Francisco', '1675 Howard St, San Francisco, CA 94103', ST_SetSRID(ST_MakePoint(-122.4189, 37.7730),4326)::geography, ARRAY['BMW scheduled maintenance','Diagnostics','Brake service','Tire service'], ARRAY['shop'], TRUE, 'BMW dealership service appointments.', '+1 (555) 010-2103', 'bmw-sf@wingman-demo.example', 'https://www.bmwsf.com/'),
            ('b4e18cfa-3a10-4d01-9981-000000000004', 'big-o-san-diego', 'Big O Tires', 'tire', 'San Diego', '1045 University Ave, San Diego, CA 92103', ST_SetSRID(ST_MakePoint(-117.1540, 32.7488),4326)::geography, ARRAY['Tires','Wheel alignment','Brake service','Oil change'], ARRAY['shop'], TRUE, 'Tires, alignment, and routine vehicle care.', '+1 (555) 010-2104', 'bigo-sd@wingman-demo.example', 'https://www.bigotires.com/'),
            ('b4e18cfa-3a10-4d01-9981-000000000005', 'aaa-sacramento-demo', 'AAA Roadside Assistance', 'towing', 'Sacramento', '1515 River Park Dr, Sacramento, CA 95815', ST_SetSRID(ST_MakePoint(-121.4378, 38.6038),4326)::geography, ARRAY['Towing','Battery service','Flat tire help','Lockout help'], ARRAY['mobile'], FALSE, 'Roadside assistance directory listing for demo discovery.', '+1 (555) 010-2105', 'aaa-sacramento@wingman-demo.example', 'https://mwg.aaa.com/automotive/roadside-assistance'),
            ('b4e18cfa-3a10-4d01-9981-000000000006', 'oreilly-san-jose', 'O''Reilly Auto Parts', 'parts', 'San Jose', '1777 Story Rd, San Jose, CA 95122', ST_SetSRID(ST_MakePoint(-121.8403, 37.3374),4326)::geography, ARRAY['Batteries','Motor oil','Filters','Brake parts','Wipers'], ARRAY['parts'], FALSE, 'Parts and basic maintenance products.', '+1 (555) 010-2106', 'oreilly-sj@wingman-demo.example', 'https://www.oreillyauto.com/'),
            ('b4e18cfa-3a10-4d01-9981-000000000007', 'pep-boys-oakland', 'Pep Boys', 'repair', 'Oakland', '4000 International Blvd, Oakland, CA 94601', ST_SetSRID(ST_MakePoint(-122.2155, 37.7840),4326)::geography, ARRAY['Oil change','Brakes','Tires','Battery service','Diagnostics'], ARRAY['shop'], TRUE, 'Routine auto repair and service appointments.', '+1 (555) 010-2107', 'pepboys-oakland@wingman-demo.example', 'https://www.pepboys.com/'),
            ('b4e18cfa-3a10-4d01-9981-000000000008', 'midas-irvine', 'Midas', 'repair', 'Irvine', '15380 Barranca Pkwy, Irvine, CA 92618', ST_SetSRID(ST_MakePoint(-117.7300, 33.6740),4326)::geography, ARRAY['Oil change','Brakes','Suspension','Exhaust','Tires'], ARRAY['shop'], TRUE, 'Automotive maintenance and repair.', '+1 (555) 010-2108', 'midas-irvine@wingman-demo.example', 'https://www.midas.com/'),
            ('b4e18cfa-3a10-4d01-9981-000000000009', 'advance-fresno', 'Advance Auto Parts', 'parts', 'Fresno', '3050 W Shaw Ave, Fresno, CA 93711', ST_SetSRID(ST_MakePoint(-119.8470, 36.8080),4326)::geography, ARRAY['Oil and filters','Batteries','Brakes','Wipers','Tools'], ARRAY['parts'], FALSE, 'Parts for at-home maintenance.', '+1 (555) 010-2109', 'advance-fresno@wingman-demo.example', 'https://shop.advanceautoparts.com/'),
            ('b4e18cfa-3a10-4d01-9981-000000000010', 'jiffy-lube-riverside', 'Jiffy Lube', 'repair', 'Riverside', '10280 Indiana Ave, Riverside, CA 92503', ST_SetSRID(ST_MakePoint(-117.4440, 33.9020),4326)::geography, ARRAY['Oil change','Filters','Fluid service','Wipers'], ARRAY['shop'], TRUE, 'Routine preventative maintenance.', '+1 (555) 010-2110', 'jiffylube-riverside@wingman-demo.example', 'https://www.jiffylube.com/')
          ON CONFLICT (external_key) DO UPDATE SET
            name = EXCLUDED.name, category = EXCLUDED.category, city = EXCLUDED.city,
            address = EXCLUDED.address, location = EXCLUDED.location, services = EXCLUDED.services,
            service_modes = EXCLUDED.service_modes, can_schedule = EXCLUDED.can_schedule,
            description = EXCLUDED.description, synthetic_phone = EXCLUDED.synthetic_phone,
            synthetic_email = EXCLUDED.synthetic_email, website_url = EXCLUDED.website_url
        """))
        await conn.execute(text("""
          INSERT INTO owner_part_products (id, provider_id, name, brand, category, price, stock_count, description)
          VALUES
            ('b4e18cfa-3a10-4d01-9981-100000000001', 'b4e18cfa-3a10-4d01-9981-000000000002', 'Duralast Gold Battery', 'Duralast', 'Battery', 214.99, 12, '12V replacement battery with fixed demo price.'),
            ('b4e18cfa-3a10-4d01-9981-100000000002', 'b4e18cfa-3a10-4d01-9981-000000000002', 'High Mileage 5W-30 Oil', 'STP', 'Oil and filters', 32.99, 30, 'Five-quart motor oil for at-home maintenance.'),
            ('b4e18cfa-3a10-4d01-9981-100000000003', 'b4e18cfa-3a10-4d01-9981-000000000006', 'Ceramic Brake Pad Set', 'BrakeBest', 'Brakes', 74.99, 8, 'Front brake pad set.'),
            ('b4e18cfa-3a10-4d01-9981-100000000004', 'b4e18cfa-3a10-4d01-9981-000000000006', 'All-Season Wiper Pair', 'Rain-X', 'Wipers', 39.99, 20, 'Pair of replacement windshield wipers.'),
            ('b4e18cfa-3a10-4d01-9981-100000000005', 'b4e18cfa-3a10-4d01-9981-000000000009', 'Oil Change Essentials Kit', 'Fram', 'Oil and filters', 44.99, 16, 'Oil filter and maintenance consumables.'),
            ('b4e18cfa-3a10-4d01-9981-100000000006', 'b4e18cfa-3a10-4d01-9981-000000000009', 'Portable Tire Inflator', 'Slime', 'Tools', 36.99, 10, 'Compact emergency tire inflator.')
          ON CONFLICT (id) DO UPDATE SET price = EXCLUDED.price, stock_count = EXCLUDED.stock_count, description = EXCLUDED.description
        """))
