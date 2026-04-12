# RoadAssist Demo Checklist

## Demo Accounts

- Owner: `owner1@example.com` / `Password123!`
- Mechanic: `mechanic1@roadassist.in` / `Password123!`
- Admin: `admin1@roadassist.in` / `Password123!`

## Demo Goal

Show a complete roadside-assistance workflow:

1. Owner finds a nearby mechanic in Richmond
2. Owner checks part availability
3. Owner sends a request to a selected mechanic
4. Mechanic accepts and updates job status
5. Owner sees the request progress
6. Admin shows analytics / platform oversight

## Before You Present

- Open the frontend: `https://road-assist-chi.vercel.app`
- Confirm login works for all three roles
- Confirm Richmond mechanics appear on the map
- Confirm owner vehicles show Virginia plates, not Hyderabad plates
- Confirm parts search suggestions open and close properly

## Presentation Flow

### 1. Owner Flow

Login as:

- `owner1@example.com`

Show:

- Search screen with Richmond mechanics
- Enter pickup location or use current location
- Select a mechanic from the map or list
- Open `Parts` from the selected mechanic panel
- Search a part such as `Brake Pads` or `Oxygen Sensor`
- Show that nearby inventory appears before requesting help

Then send a request:

1. Select a mechanic
2. Click `Request`
3. Choose a vehicle
4. Enter a realistic problem like:
   - `Car won't start after parking downtown`
5. Submit the request

Talking point:

- The request now stays tied to the selected mechanic instead of becoming a generic open request.

### 2. Mechanic Flow

Log out, then login as:

- `mechanic1@roadassist.in`

Go to:

- `Dashboard`
- `Jobs`

Show:

- The targeted request appears for that mechanic
- Mechanic accepts the request
- Mechanic changes status from:
  - `requested` -> `accepted`
  - `accepted` -> `in_progress`
  - `in_progress` -> `completed`

Talking point:

- Acceptance uses a stored procedure / transactional backend path
- Status updates are tracked in job history

### 3. Owner History / Review

Log back in as:

- `owner1@example.com`

Show:

- `History` in the header
- Request timeline / status progression
- Review submission after completion

Talking point:

- Owners can track service history and rate mechanics after the job is done.

### 4. Admin Flow

Log out, then login as:

- `admin1@roadassist.in`

Show:

- Admin analytics
- Mechanic visibility / control
- Platform overview

Talking point:

- Admin can monitor adoption, platform usage, and mechanic network activity.

## Good Demo Storyline

Use this scenario:

- A Richmond owner has a brake issue near downtown
- They search nearby mechanics
- They confirm the needed part is available
- They request help from a specific mechanic
- That mechanic accepts and completes the job

This is easy to explain and matches the UI well.

## Backup Demo Inputs

Pickup examples:

- `Richmond, VA 23219`
- `111 E Main St, Richmond, VA`
- `23220`

Part examples:

- `Brake Pads`
- `Brake Fluid`
- `Oxygen Sensor`
- `Battery`

Problem description examples:

- `Brake warning light came on and pedal feels soft`
- `Battery died and the car will not start`
- `Engine cranks but does not turn over`

## If Something Fails Mid-Demo

- Refresh the page once and retry the action
- Use typed pickup location instead of browser geolocation
- Use the owner history panel instead of navigating around multiple pages
- If parts suggestions stay open, click outside and retry the search

## Technical Talking Points For Professor

- PostgreSQL + PostGIS powers proximity search
- Nearby mechanics are queried geospatially
- Spare-parts inventory is searchable before request creation
- Service requests keep a status history through `job_updates`
- Ratings and alerts are DB-backed
- The app supports owner, mechanic, and admin roles

## Final 30-Second Summary

RoadAssist helps a stranded vehicle owner:

1. find a nearby mechanic
2. confirm whether a needed spare part is in stock
3. send a live service request
4. track the job from request to completion

At the same time, mechanics manage jobs and inventory, while admins monitor the network.
