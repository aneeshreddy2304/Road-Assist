from sqlalchemy import text

from app.db.session import engine


WAREHOUSE_SEED_SQL = """
INSERT INTO users (id, name, email, password_hash, phone, role, is_active, created_at, updated_at)
VALUES
  ('8ddf8c31-67fa-4cae-b45a-4c66985cbf01', 'Blue Ridge Auto Supply', 'warehouse1@roadassist.in', '$2a$12$K8HkR3YwEh0M1z7nV2F4iuLlGW5AXm9pqT6sD3rJcBfNvOyE8W2Ki', '+1-804-555-4001', 'warehouse', TRUE, NOW(), NOW()),
  ('12f974b4-ff1e-4f4e-8cf7-315d3eb92e02', 'James River Parts Hub', 'warehouse2@roadassist.in', '$2a$12$K8HkR3YwEh0M1z7nV2F4iuLlGW5AXm9pqT6sD3rJcBfNvOyE8W2Ki', '+1-804-555-4002', 'warehouse', TRUE, NOW(), NOW()),
  ('fd00d65a-d3e9-4b07-a28a-f95d9dcb2d03', 'River City EV Components', 'warehouse3@roadassist.in', '$2a$12$K8HkR3YwEh0M1z7nV2F4iuLlGW5AXm9pqT6sD3rJcBfNvOyE8W2Ki', '+1-804-555-4003', 'warehouse', TRUE, NOW(), NOW()),
  ('a6b1b6c4-26bf-4cb0-bef7-35df56d1c104', 'Broad Street Brake Depot', 'warehouse4@roadassist.in', '$2a$12$K8HkR3YwEh0M1z7nV2F4iuLlGW5AXm9pqT6sD3rJcBfNvOyE8W2Ki', '+1-804-555-4004', 'warehouse', TRUE, NOW(), NOW()),
  ('d7c2f5bf-e5d0-4aaf-8f08-8d3bfa93af05', 'Capital Fleet Warehouse', 'warehouse5@roadassist.in', '$2a$12$K8HkR3YwEh0M1z7nV2F4iuLlGW5AXm9pqT6sD3rJcBfNvOyE8W2Ki', '+1-804-555-4005', 'warehouse', TRUE, NOW(), NOW()),
  ('73ddb614-9037-453b-817f-bc1f182acd06', 'Southside Rapid Spares', 'warehouse6@roadassist.in', '$2a$12$K8HkR3YwEh0M1z7nV2F4iuLlGW5AXm9pqT6sD3rJcBfNvOyE8W2Ki', '+1-804-555-4006', 'warehouse', TRUE, NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

INSERT INTO warehouses (id, user_id, name, address, lat, lng, contact_phone, description, fulfillment_hours, is_active, created_at, updated_at)
VALUES
  ('d4d4af8e-18ef-4e1c-a6f5-f1f8cd620101', '8ddf8c31-67fa-4cae-b45a-4c66985cbf01', 'Blue Ridge Auto Supply', '2601 W Broad St, Richmond, VA', 37.553200, -77.474900, '+1-804-555-4001', 'Downtown-ready general parts supplier with high-turn stock for emergency roadside jobs.', 'Mon-Sat 07:00 AM - 09:00 PM', TRUE, NOW(), NOW()),
  ('e790a310-444e-4cb0-8820-912ece580102', '12f974b4-ff1e-4f4e-8cf7-315d3eb92e02', 'James River Parts Hub', '1201 Hull St, Richmond, VA', 37.526100, -77.445500, '+1-804-555-4002', 'Balanced mixed inventory with filters, cooling, lighting, and driveline essentials.', 'Daily 08:00 AM - 08:00 PM', TRUE, NOW(), NOW()),
  ('af0d2cb6-0b13-48bd-921e-835064c70103', 'fd00d65a-d3e9-4b07-a28a-f95d9dcb2d03', 'River City EV Components', '4801 W Broad St, Richmond, VA', 37.582500, -77.498400, '+1-804-555-4003', 'EV-focused warehouse with batteries, charging accessories, sensors, and modules.', 'Mon-Fri 08:00 AM - 07:00 PM', TRUE, NOW(), NOW()),
  ('af93aa5c-eb9d-4ff4-8aef-3c96c9ad0104', 'a6b1b6c4-26bf-4cb0-bef7-35df56d1c104', 'Broad Street Brake Depot', '3301 W Broad St, Richmond, VA', 37.558100, -77.482800, '+1-804-555-4004', 'Pads, rotors, calipers, and brake fluids kept deep for same-day mechanic pickup.', 'Daily 07:30 AM - 09:30 PM', TRUE, NOW(), NOW()),
  ('8f9f75cb-aaf9-4a68-97d3-331a1b230105', 'd7c2f5bf-e5d0-4aaf-8f08-8d3bfa93af05', 'Capital Fleet Warehouse', '6400 Midlothian Tpke, Richmond, VA', 37.503900, -77.517100, '+1-804-555-4005', 'Fleet and commercial stock for vans, SUVs, and light trucks.', 'Mon-Sat 06:00 AM - 10:00 PM', TRUE, NOW(), NOW()),
  ('bbcbdd48-cd16-4a72-83f5-ff5fd2530106', '73ddb614-9037-453b-817f-bc1f182acd06', 'Southside Rapid Spares', '4700 Forest Hill Ave, Richmond, VA', 37.517100, -77.503500, '+1-804-555-4006', 'Fast-moving emergency stock with batteries, bulbs, ignition, and starter components.', 'Daily 24/7 emergency desk', TRUE, NOW(), NOW())
ON CONFLICT (user_id) DO NOTHING;

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
        await conn.execute(
            text(
                """
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
                )
                """
            )
        )
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
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_warehouse_messages_thread ON warehouse_messages (warehouse_id, mechanic_id, created_at ASC)"))
        await conn.execute(text(WAREHOUSE_SEED_SQL))
