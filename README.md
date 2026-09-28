# Mashi — let's go to your destination

Boda and tuk-tuk ride-hailing for Juba. One Next.js app with three parts:

- `/rider`: set pickup and drop-off on the map, see the price, book, track the driver live, pay in cash or mobile money.
- `/driver`: register a vehicle, wait for verification, go online, accept nearby requests, move the trip from pickup to completion.
- `/admin`: approve or suspend drivers, watch rides, set prices per vehicle type.

Stack: Next.js 16, TypeScript, Tailwind v4, Supabase (Postgres, login, live updates), Leaflet with OpenStreetMap. It installs as an app from the browser (PWA).

## 1. Create the database (Supabase, free tier)

1. Create a project at supabase.com.
2. Open **SQL Editor → New query**, paste all of `supabase/schema.sql`, and click **Run**.
3. Open **Authentication → Sign In / Providers → Email** and turn off **Confirm email** while testing.
4. Open **Project Settings → API** and copy the Project URL and the `anon` public key.

### Updates

After `schema.sql`, run `supabase/002_commissions_ratings.sql` once in the SQL Editor. It adds commissions, driver payments and ratings.

## 2. Run it on your PC (PowerShell)

```powershell
cd mashi
Copy-Item .env.local.example .env.local
notepad .env.local      # paste your Supabase URL and anon key
npm install
npm run dev
```

Open http://localhost:3000.

## 3. Make yourself admin

Create an account in the app, then run this in the Supabase SQL Editor:

```sql
update profiles set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```

Sign in again and go to `/admin`. **Set real prices on the Prices tab before launch.** The starting prices are placeholders.

## 4. Test a full trip on one PC

1. Normal browser window: sign up as a driver ("I want to drive"), register a boda.
2. In `/admin`, approve the driver.
3. Private/incognito window: sign up as a rider and request a boda near the driver.
4. Driver: go online. If the laptop has no GPS, tap the map to set the driver's position.
5. Accept the ride, then tap through arrived → start trip → complete. The rider screen updates live.

## 5. Deploy (Vercel)

Push to GitHub, import the repo in Vercel, and add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as environment variables.

## How it works

- **Prices** are calculated on the server in `request_ride()`: base + per-km × distance, rounded to 100 SSP, never below the minimum. Riders see the same estimate before booking (`lib/geo.ts`).
- **Distance** is straight-line × 1.3 to approximate roads. Swap in a routing service later for exact road distance.
- **Matching**: online, verified drivers see requests for their vehicle type within 6 km from the last 15 minutes. The first driver to accept gets the ride; others see "Another driver already took this ride".
- **Security**: all ride changes go through database functions. Users cannot edit rides, verify themselves, or make themselves admin. Riders see a driver's location only during their active ride.
- **Data use**: drivers send location at most every 10 seconds.

## Before a public launch

- Switch map tiles from the free OpenStreetMap server to a paid tile provider (MapTiler, Stadia or similar). The free server isn't meant for commercial traffic.
- Replace email login with phone number + SMS code (Supabase phone auth with an SMS provider that delivers to South Sudan).
- Add ratings, an SOS/share-trip button, and driver commission tracking.
- Connect mobile money payments through your payments platform.
- Wrap the app with Capacitor to publish on Google Play.
