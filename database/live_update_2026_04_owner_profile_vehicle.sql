ALTER TABLE users
  ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
  ADD COLUMN IF NOT EXISTS street_address TEXT,
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS state VARCHAR(100),
  ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20);

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS nickname VARCHAR(80),
  ADD COLUMN IF NOT EXISTS fuel_type VARCHAR(30),
  ADD COLUMN IF NOT EXISTS color VARCHAR(30);

DELETE FROM vehicles
WHERE owner_id = '34679a0e-5a14-43f3-9c99-274cabf13f89'
  AND license_plate LIKE 'TS%';

UPDATE users AS u
SET
  gender = v.gender,
  street_address = v.street_address,
  city = 'Richmond',
  state = 'VA',
  postal_code = v.postal_code,
  phone = v.phone
FROM (
  VALUES
    ('owner1@example.com', 'Female', '1912 Grove Ave', '23220', '+1-804-555-0101'),
    ('owner2@example.com', 'Female', '3116 Kensington Ave', '23221', '+1-804-555-0102'),
    ('owner3@example.com', 'Male', '1209 W Cary St', '23220', '+1-804-555-0103'),
    ('owner4@example.com', 'Female', '418 N 28th St', '23223', '+1-804-555-0104'),
    ('owner5@example.com', 'Male', '2201 E Franklin St', '23223', '+1-804-555-0105'),
    ('owner6@example.com', 'Male', '104 N Addison St', '23220', '+1-804-555-0106'),
    ('owner7@example.com', 'Male', '2700 Parkwood Ave', '23220', '+1-804-555-0107'),
    ('owner8@example.com', 'Male', '402 W Clay St', '23220', '+1-804-555-0108'),
    ('owner9@example.com', 'Female', '510 Libbie Ave', '23226', '+1-804-555-0109'),
    ('owner10@example.com', 'Male', '1411 Hull St', '23224', '+1-804-555-0110'),
    ('owner11@example.com', 'Male', '4801 Monument Ave', '23230', '+1-804-555-0111'),
    ('owner12@example.com', 'Female', '603 N 22nd St', '23223', '+1-804-555-0112'),
    ('owner13@example.com', 'Male', '2618 Floyd Ave', '23220', '+1-804-555-0113'),
    ('owner14@example.com', 'Male', '1624 Bellevue Ave', '23227', '+1-804-555-0114'),
    ('owner15@example.com', 'Female', '3708 Seminary Ave', '23227', '+1-804-555-0115'),
    ('owner16@example.com', 'Male', '3301 Kensington Ave', '23221', '+1-804-555-0116'),
    ('owner17@example.com', 'Female', '2214 W Main St', '23220', '+1-804-555-0117'),
    ('owner18@example.com', 'Female', '713 N 32nd St', '23223', '+1-804-555-0118'),
    ('owner19@example.com', 'Female', '3114 Grayland Ave', '23221', '+1-804-555-0119'),
    ('owner20@example.com', 'Female', '1810 Monument Ave', '23220', '+1-804-555-0120'),
    ('owner21@example.com', 'Female', '2625 E Marshall St', '23223', '+1-804-555-0121'),
    ('owner22@example.com', 'Female', '4931 Forest Hill Ave', '23225', '+1-804-555-0122'),
    ('owner23@example.com', 'Female', '1027 W Franklin St', '23220', '+1-804-555-0123'),
    ('owner24@example.com', 'Female', '5400 Patterson Ave', '23226', '+1-804-555-0124'),
    ('owner25@example.com', 'Female', '1716 Grove Ave', '23220', '+1-804-555-0125')
) AS v(email, gender, street_address, postal_code, phone)
WHERE u.email = v.email;

UPDATE vehicles AS v
SET
  nickname = spec.nickname,
  make = spec.make,
  model = spec.model,
  year = spec.year,
  license_plate = spec.license_plate,
  vehicle_type = spec.vehicle_type::vehicle_type,
  fuel_type = spec.fuel_type,
  color = spec.color,
  notes = spec.notes
FROM (
  VALUES
    ('15fcd8cc-e466-472f-b716-1ec679c9bd55', 'Bluebird', 'Tesla', 'Model 3', 2023, 'RVA-3101', 'car', 'electric', 'Deep Blue', 'Primary commuter sedan'),
    ('03869381-0b36-446b-b049-a79fef25d1d9', 'Weekend Rover', 'Honda', 'CR-V', 2021, 'RVA-3102', 'suv', 'gasoline', 'Pearl White', 'Family crossover'),
    ('a29447a5-1998-48d2-b259-38ad3964bdbf', 'Office Ride', 'Toyota', 'Camry', 2022, 'RVA-3103', 'car', 'hybrid', 'Silver', 'Daily downtown commuter'),
    ('4eb5c982-63c5-42a8-ac67-12b506694af0', 'Trail Mate', 'Subaru', 'Outback', 2020, 'RVA-3104', 'suv', 'gasoline', 'Forest Green', 'Weekend road-trip car'),
    ('bb94e7bf-6a74-4225-b34e-f20814929e55', 'Church Hill', 'Hyundai', 'Sonata', 2021, 'RVA-3105', 'car', 'gasoline', 'Black', 'Owner keeps this for city driving'),
    ('5806cac2-15aa-4f84-8be8-d2abc45efce7', 'River Runner', 'Mazda', 'CX-5', 2024, 'RVA-3106', 'suv', 'gasoline', 'Machine Gray', 'Newer family SUV'),
    ('4b7e11eb-260c-4c11-9120-cced98a1a3cf', 'Carytown Cruiser', 'Nissan', 'Altima', 2019, 'RVA-3107', 'car', 'gasoline', 'Champagne', 'Reliable city sedan'),
    ('4e84422e-19d9-41ad-9435-e992f05fce84', 'Museum Mile', 'Toyota', 'RAV4', 2022, 'RVA-3108', 'suv', 'hybrid', 'White', 'Shared household vehicle'),
    ('02eed0a4-8c11-4109-b322-8f648db82543', 'Family First', 'Kia', 'Telluride', 2023, 'RVA-3109', 'suv', 'gasoline', 'Midnight Blue', 'Three-row family SUV'),
    ('4844cdec-010d-4f8b-88f6-79b8994f0b8f', 'Downtown Compact', 'Chevrolet', 'Malibu', 2018, 'RVA-3110', 'car', 'gasoline', 'Red', 'Compact backup car'),
    ('b42a16cb-894a-49d8-8494-5a208cf23ada', 'Willow Lawn', 'Ford', 'Escape', 2021, 'RVA-3111', 'suv', 'hybrid', 'Carbonized Gray', 'Primary crossover'),
    ('bbe7b86f-4e6b-4096-83cb-76f5942a5ebd', 'Night Shift', 'Honda', 'Accord', 2020, 'RVA-3112', 'car', 'gasoline', 'Black', 'Used for late commute home'),
    ('2279e844-ad80-414b-af56-7a92949a4604', 'Belle Isle', 'Jeep', 'Grand Cherokee', 2022, 'RVA-3113', 'suv', 'gasoline', 'Granite', 'Weekend and mountain trips'),
    ('2e04026f-48ad-4206-bff0-66ec05bc4fa8', 'Main Street', 'Hyundai', 'Elantra', 2023, 'RVA-3114', 'car', 'gasoline', 'Blue', 'Fuel-efficient sedan'),
    ('15b38469-edf3-4ab2-bc26-04614c500ad0', 'Northside', 'Toyota', 'Highlander', 2021, 'RVA-3115', 'suv', 'hybrid', 'Pearl White', 'School-run vehicle'),
    ('8a97057f-cca8-4207-831b-e2583e8a380a', 'Quick Errands', 'Mazda', '3', 2019, 'RVA-3116', 'car', 'gasoline', 'Soul Red', 'Compact hatch for errands'),
    ('0b35e84c-aab7-4906-a639-1b57db7324aa', 'Fan Favorite', 'Honda', 'Civic', 2022, 'RVA-3117', 'car', 'gasoline', 'Meteorite Gray', 'Primary sedan'),
    ('e7de7c50-ec0c-4b04-976d-04bf3833de62', 'Highway One', 'Subaru', 'Forester', 2021, 'RVA-3118', 'suv', 'gasoline', 'Ice Silver', 'All-weather crossover'),
    ('6dc01574-dd73-4603-a693-1634bfdea8ac', 'West End', 'Toyota', 'Corolla', 2018, 'RVA-3119', 'car', 'gasoline', 'Classic Silver', 'Budget-friendly daily car'),
    ('3a68f67d-0a2a-4797-9c90-c9c1ece2a71b', 'Family Wagon', 'Volkswagen', 'Atlas', 2021, 'RVA-3120', 'suv', 'gasoline', 'White', 'Large family hauler'),
    ('befb1aec-fd1a-43b0-85d0-3d02665982b2', 'City Pulse', 'Hyundai', 'Tucson', 2023, 'RVA-3121', 'suv', 'hybrid', 'Amazon Gray', 'Primary Richmond commuter'),
    ('637c1f90-d6d5-477b-b7b1-9e2f022f9dd3', 'Museum District', 'Nissan', 'Sentra', 2020, 'RVA-3122', 'car', 'gasoline', 'Gun Metallic', 'Secondary city car'),
    ('2832e14b-944e-44dc-9fcf-c82dc06b392c', 'Curbside', 'Kia', 'Sportage', 2024, 'RVA-3123', 'suv', 'gasoline', 'Sapphire Blue', 'Newest household SUV'),
    ('3e1a0752-acd8-43df-87a0-94ef54d73c93', 'Shockoe Sedan', 'Toyota', 'Prius', 2022, 'RVA-3124', 'car', 'hybrid', 'White', 'Excellent mileage around town'),
    ('23a9e456-0855-47f1-9cea-9ffe1ac0806b', 'Maple Run', 'Honda', 'HR-V', 2021, 'RVA-3125', 'suv', 'gasoline', 'Lunar Silver', 'Neighborhood runabout'),
    ('cc1401a2-30ed-4b14-8c2a-2742a2a13990', 'Pocket Sedan', 'Chevrolet', 'Cruze', 2018, 'RVA-3126', 'car', 'gasoline', 'Blue', 'Compact city sedan'),
    ('b471b9c4-6628-4958-85b9-ca0f54eb1b58', 'Weekend Drive', 'Mazda', 'CX-30', 2022, 'RVA-3127', 'suv', 'gasoline', 'Black', 'Primary crossover'),
    ('76e56942-55f9-429e-b9d7-54f44ae429f9', 'Southside', 'Honda', 'Accord', 2019, 'RVA-3128', 'car', 'hybrid', 'White', 'Used for weekday commuting'),
    ('865ba21a-55b6-4538-86e2-5927af983a7f', 'Forest Hill', 'Subaru', 'Crosstrek', 2021, 'RVA-3129', 'suv', 'gasoline', 'Orange', 'Adventure-ready crossover'),
    ('820fa2fb-1f34-4d4d-891c-9b01859a6da3', 'Broad Street', 'Toyota', 'Avalon', 2018, 'RVA-3130', 'car', 'gasoline', 'Gray', 'Comfort-focused sedan'),
    ('b845d6aa-4b85-4b67-b1de-07a65c76fa8f', 'Libbie Lane', 'Hyundai', 'Kona', 2022, 'RVA-3131', 'suv', 'electric', 'Teal', 'Quiet electric commuter'),
    ('59cb6f40-5209-4be3-8714-263608c50c69', 'Quick Loop', 'Toyota', 'Corolla', 2020, 'RVA-3132', 'car', 'gasoline', 'White', 'Short-trip grocery car'),
    ('b6189307-8eeb-42b8-bb0c-ed13b5973588', 'North Avenue', 'Honda', 'CR-V', 2024, 'RVA-3133', 'suv', 'hybrid', 'Urban Gray', 'New family hybrid SUV'),
    ('3932b45a-da81-44d3-8373-46d4cbe98631', 'Office Lane', 'Nissan', 'Altima', 2021, 'RVA-3134', 'car', 'gasoline', 'Silver', 'Primary office commute'),
    ('adbaca80-edbc-49b6-aa7e-4d426e6f8ae7', 'Blue Note', 'Kia', 'Sorento', 2021, 'RVA-3135', 'suv', 'gasoline', 'Blue', 'Long-distance family crossover'),
    ('732b06ad-9291-44b8-a627-970336a1d8d6', 'Seminary Sedan', 'Mazda', '6', 2018, 'RVA-3136', 'car', 'gasoline', 'Snowflake White', 'Weekend sedan'),
    ('e28b4f2c-078f-46ed-8237-8b46dc056afb', 'West Cary', 'Toyota', 'Venza', 2023, 'RVA-3137', 'suv', 'hybrid', 'Coastal Gray', 'Primary hybrid crossover'),
    ('914ab26b-2cd8-4c76-955d-925dc3464a58', 'Daily Loop', 'Hyundai', 'Elantra', 2019, 'RVA-3138', 'car', 'gasoline', 'Black', 'Commuter sedan'),
    ('7b9c4916-bca1-4561-8489-b7ab3b9d3f1b', 'Oak Drive', 'Subaru', 'Legacy', 2021, 'RVA-3139', 'car', 'gasoline', 'Blue', 'Reliable all-weather sedan'),
    ('d56cb8ba-7337-4059-a86d-2afb384273ac', 'River Bend', 'Ford', 'Bronco Sport', 2022, 'RVA-3140', 'suv', 'gasoline', 'Cactus Gray', 'Outdoor-friendly SUV'),
    ('473f8ee9-76d2-4b92-801f-19d3ee5d1ae0', 'Manchester', 'Honda', 'Insight', 2020, 'RVA-3141', 'car', 'hybrid', 'Silver', 'Hybrid city commuter'),
    ('abf4a838-8a47-4ebd-8ff1-1b6f018ac1f0', 'Canal Walk', 'Toyota', 'RAV4', 2019, 'RVA-3142', 'suv', 'gasoline', 'White', 'Shared family SUV'),
    ('9e6342f0-0b81-4b0a-aa62-8e2e1b129fea', 'Lakeside', 'Mazda', 'CX-50', 2024, 'RVA-3143', 'suv', 'gasoline', 'Sand', 'Newer utility vehicle'),
    ('f3186bd0-14c5-4459-9242-830a90f3b2b4', 'Grace Street', 'Hyundai', 'Sonata', 2022, 'RVA-3144', 'car', 'hybrid', 'Portofino Gray', 'Daily downtown sedan'),
    ('59e31937-2d49-4620-b07f-6cea1faef02e', 'Powhatan', 'Honda', 'Passport', 2023, 'RVA-3145', 'suv', 'gasoline', 'Black', 'Large weekend SUV'),
    ('a07e529f-b4c0-4886-99a7-5edc9d69bda1', 'Fastback', 'Toyota', 'Camry', 2021, 'RVA-3146', 'car', 'gasoline', 'Ruby Flare', 'Reliable second sedan'),
    ('4dd97543-13cc-4f46-bbea-2eadc140e6bf', 'Patterson', 'Kia', 'K5', 2024, 'RVA-3147', 'car', 'gasoline', 'Wolf Gray', 'New primary sedan'),
    ('41342e9d-7721-4851-9ae3-dd45fffeb129', 'Near West', 'Hyundai', 'Santa Fe', 2022, 'RVA-3148', 'suv', 'hybrid', 'White', 'Family crossover for long trips'),
    ('1838d98b-78ba-494c-aa56-9901182f671c', 'Byrd Park', 'Toyota', 'Corolla Cross', 2023, 'RVA-3149', 'suv', 'gasoline', 'Blue Crush', 'Compact SUV for daily use'),
    ('ebf350d4-0abe-4fa3-9b25-3d822ef1b5f7', 'Monroe Ward', 'Honda', 'Civic', 2024, 'RVA-3150', 'car', 'gasoline', 'White', 'Newest sedan in the driveway')
) AS spec(id, nickname, make, model, year, license_plate, vehicle_type, fuel_type, color, notes)
WHERE v.id = spec.id;
