-- Mashi database schema
-- Run this whole file once in Supabase: SQL Editor → New query → paste → Run.

create extension if not exists pgcrypto;

-- ---------- Types ----------
create type public.user_role      as enum ('rider', 'driver', 'admin');
create type public.vehicle_type   as enum ('boda', 'tuktuk', 'car');
create type public.driver_status  as enum ('pending', 'verified', 'suspended');
create type public.ride_status    as enum ('requested', 'accepted', 'arrived', 'in_progress', 'completed', 'cancelled');
create type public.payment_method as enum ('cash', 'mobile_money');

-- ---------- Tables ----------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  phone       text not null default '',
  role        public.user_role not null default 'rider',
  created_at  timestamptz not null default now()
);

create table public.drivers (
  id                  uuid primary key references public.profiles(id) on delete cascade,
  vehicle_type        public.vehicle_type not null,
  plate_number        text not null,
  status              public.driver_status not null default 'pending',
  is_online           boolean not null default false,
  lat                 double precision,
  lng                 double precision,
  location_updated_at timestamptz,
  trips_completed     integer not null default 0,
  created_at          timestamptz not null default now()
);

create table public.fare_settings (
  vehicle_type  public.vehicle_type primary key,
  base_fare     integer not null,   -- SSP
  per_km        integer not null,   -- SSP per km
  minimum_fare  integer not null,   -- SSP
  active        boolean not null default true
);

-- PLACEHOLDER PRICES. Set real prices from the admin page before launch.
insert into public.fare_settings (vehicle_type, base_fare, per_km, minimum_fare, active) values
  ('boda',   1000,  800, 2000, true),
  ('tuktuk', 1500, 1200, 3000, true),
  ('car',    3000, 2500, 6000, false);  -- cars switched off for launch

create table public.rides (
  id              uuid primary key default gen_random_uuid(),
  rider_id        uuid not null references public.profiles(id) on delete cascade,
  driver_id       uuid references public.drivers(id) on delete set null,
  vehicle_type    public.vehicle_type not null,
  pickup_lat      double precision not null,
  pickup_lng      double precision not null,
  pickup_note     text,
  dropoff_lat     double precision not null,
  dropoff_lng     double precision not null,
  dropoff_note    text,
  distance_km     double precision not null,
  fare_ssp        integer not null,
  payment_method  public.payment_method not null default 'cash',
  status          public.ride_status not null default 'requested',
  cancelled_by    uuid,
  created_at      timestamptz not null default now(),
  accepted_at     timestamptz,
  completed_at    timestamptz,
  cancelled_at    timestamptz
);

create index rides_rider_idx  on public.rides (rider_id, created_at desc);
create index rides_driver_idx on public.rides (driver_id, status);
create index rides_open_idx   on public.rides (status, vehicle_type, created_at);

-- ---------- Helpers ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- Straight-line distance × 1.3 to approximate road distance. Must match lib/geo.ts.
create or replace function public.road_distance_km(lat1 float8, lng1 float8, lat2 float8, lng2 float8)
returns float8 language sql immutable as $$
  select round((6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )) * 1.3)::numeric, 2)::float8;
$$;

-- New sign-ups get a profile automatically.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, phone)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', ''),
          coalesce(new.raw_user_meta_data->>'phone', ''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Rider actions ----------
create or replace function public.request_ride(
  p_vehicle public.vehicle_type,
  p_pickup_lat float8, p_pickup_lng float8, p_pickup_note text,
  p_dropoff_lat float8, p_dropoff_lng float8, p_dropoff_note text,
  p_payment public.payment_method
) returns public.rides
language plpgsql security definer set search_path = public as $$
declare
  s    fare_settings;
  km   float8;
  new_ride rides;
begin
  if auth.uid() is null then raise exception 'Sign in to request a ride'; end if;

  if exists (select 1 from rides where rider_id = auth.uid()
             and status in ('requested','accepted','arrived','in_progress')) then
    raise exception 'You already have a ride in progress';
  end if;

  select * into s from fare_settings where vehicle_type = p_vehicle and active;
  if not found then raise exception 'This ride type is not available yet'; end if;

  km := road_distance_km(p_pickup_lat, p_pickup_lng, p_dropoff_lat, p_dropoff_lng);
  if km < 0.2 then raise exception 'Pickup and drop-off are too close together'; end if;
  if km > 60  then raise exception 'Drop-off is too far away for this ride type'; end if;

  insert into rides (rider_id, vehicle_type, pickup_lat, pickup_lng, pickup_note,
                     dropoff_lat, dropoff_lng, dropoff_note, distance_km, fare_ssp, payment_method)
  values (auth.uid(), p_vehicle, p_pickup_lat, p_pickup_lng, nullif(trim(p_pickup_note), ''),
          p_dropoff_lat, p_dropoff_lng, nullif(trim(p_dropoff_note), ''), km,
          greatest(s.minimum_fare, (round((s.base_fare + s.per_km * km) / 100) * 100)::int),
          p_payment)
  returning * into new_ride;

  return new_ride;
end $$;

-- Rider cancels the ride, or driver releases it back to other drivers.
create or replace function public.cancel_ride(p_ride uuid) returns public.rides
language plpgsql security definer set search_path = public as $$
declare r rides;
begin
  update rides set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid()
   where id = p_ride and rider_id = auth.uid() and status in ('requested','accepted','arrived')
   returning * into r;
  if found then return r; end if;

  update rides set status = 'requested', driver_id = null, accepted_at = null, created_at = now()
   where id = p_ride and driver_id = auth.uid() and status in ('accepted','arrived')
   returning * into r;
  if found then return r; end if;

  raise exception 'This ride can no longer be cancelled';
end $$;

-- ---------- Driver actions ----------
create or replace function public.register_driver(p_vehicle public.vehicle_type, p_plate text)
returns public.drivers
language plpgsql security definer set search_path = public as $$
declare d drivers;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if length(trim(coalesce(p_plate, ''))) < 3 then raise exception 'Enter your plate number'; end if;

  insert into drivers (id, vehicle_type, plate_number)
  values (auth.uid(), p_vehicle, upper(trim(p_plate)))
  on conflict (id) do update
    set vehicle_type = excluded.vehicle_type,
        plate_number = excluded.plate_number,
        status = 'pending',
        is_online = false
  returning * into d;

  update profiles set role = 'driver' where id = auth.uid() and role = 'rider';
  return d;
end $$;

create or replace function public.set_driver_online(p_online boolean) returns public.drivers
language plpgsql security definer set search_path = public as $$
declare d drivers;
begin
  update drivers set is_online = p_online
   where id = auth.uid() and (status = 'verified' or p_online = false)
   returning * into d;
  if not found then raise exception 'Your account has not been verified yet'; end if;
  return d;
end $$;

create or replace function public.update_driver_location(p_lat float8, p_lng float8) returns void
language sql security definer set search_path = public as $$
  update drivers set lat = p_lat, lng = p_lng, location_updated_at = now() where id = auth.uid();
$$;

-- Requests a driver can see: same vehicle type, within 6 km, last 15 minutes.
create or replace function public.get_open_rides() returns setof public.rides
language sql stable security definer set search_path = public as $$
  select r.* from rides r
  join drivers d on d.id = auth.uid()
  where d.status = 'verified' and d.is_online and d.lat is not null
    and r.status = 'requested'
    and r.vehicle_type = d.vehicle_type
    and r.created_at > now() - interval '15 minutes'
    and road_distance_km(d.lat, d.lng, r.pickup_lat, r.pickup_lng) <= 6
    and not exists (select 1 from rides x where x.driver_id = d.id
                    and x.status in ('accepted','arrived','in_progress'))
  order by r.created_at
  limit 20;
$$;

create or replace function public.accept_ride(p_ride uuid) returns public.rides
language plpgsql security definer set search_path = public as $$
declare
  d drivers;
  r rides;
begin
  select * into d from drivers where id = auth.uid() and status = 'verified' and is_online;
  if not found then raise exception 'Go online to accept rides'; end if;

  if exists (select 1 from rides where driver_id = d.id and status in ('accepted','arrived','in_progress')) then
    raise exception 'Finish your current ride first';
  end if;

  update rides set driver_id = d.id, status = 'accepted', accepted_at = now()
   where id = p_ride and status = 'requested' and vehicle_type = d.vehicle_type
   returning * into r;
  if not found then raise exception 'Another driver already took this ride'; end if;
  return r;
end $$;

create or replace function public.advance_ride(p_ride uuid, p_status public.ride_status) returns public.rides
language plpgsql security definer set search_path = public as $$
declare r rides;
begin
  update rides set status = p_status,
                   completed_at = case when p_status = 'completed' then now() else completed_at end
   where id = p_ride and driver_id = auth.uid()
     and ((status = 'accepted'    and p_status = 'arrived')
       or (status = 'arrived'     and p_status = 'in_progress')
       or (status = 'in_progress' and p_status = 'completed'))
   returning * into r;
  if not found then raise exception 'That step is not allowed right now'; end if;

  if p_status = 'completed' then
    update drivers set trips_completed = trips_completed + 1 where id = auth.uid();
  end if;
  return r;
end $$;

-- ---------- Row level security ----------
alter table public.profiles      enable row level security;
alter table public.drivers       enable row level security;
alter table public.rides         enable row level security;
alter table public.fare_settings enable row level security;

-- Profiles: yourself, admins, and the other person on a ride you share.
create policy profiles_select on public.profiles for select using (
  id = auth.uid() or public.is_admin() or exists (
    select 1 from public.rides r
    where (r.rider_id = auth.uid() and r.driver_id = profiles.id)
       or (r.driver_id = auth.uid() and r.rider_id = profiles.id)
  )
);
create policy profiles_admin_update on public.profiles for update
  using (public.is_admin()) with check (public.is_admin());

-- Drivers: yourself, admins, and riders during an active ride (to see plate and location).
create policy drivers_select on public.drivers for select using (
  id = auth.uid() or public.is_admin() or exists (
    select 1 from public.rides r
    where r.driver_id = drivers.id and r.rider_id = auth.uid()
      and r.status in ('accepted','arrived','in_progress')
  )
);
create policy drivers_admin_update on public.drivers for update
  using (public.is_admin()) with check (public.is_admin());

-- Rides: read-only for the rider, driver and admins. All changes go through the functions above.
create policy rides_select on public.rides for select using (
  rider_id = auth.uid() or driver_id = auth.uid() or public.is_admin()
);

create policy fares_select on public.fare_settings for select to authenticated using (true);
create policy fares_admin_update on public.fare_settings for update
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Live updates ----------
alter publication supabase_realtime add table public.rides;
