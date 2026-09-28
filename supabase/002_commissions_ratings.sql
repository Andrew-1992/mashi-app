-- Mashi update 002: commissions, driver payments and ratings
-- Run once in Supabase SQL Editor, AFTER schema.sql. Safe for existing data.

-- ---------- Commission rate per vehicle type ----------
alter table public.fare_settings
  add column if not exists commission_percent double precision not null default 15
  check (commission_percent >= 0 and commission_percent <= 50);

-- ---------- Commission and driver earnings locked on each ride ----------
alter table public.rides add column if not exists commission_ssp integer;
alter table public.rides add column if not exists driver_earnings_ssp integer;
alter table public.rides add column if not exists rider_rating smallint check (rider_rating between 1 and 5);

update public.rides
   set commission_ssp = round(fare_ssp * 0.15)::int,
       driver_earnings_ssp = fare_ssp - round(fare_ssp * 0.15)::int
 where commission_ssp is null;

alter table public.rides alter column commission_ssp set not null;
alter table public.rides alter column driver_earnings_ssp set not null;

-- ---------- Driver ratings ----------
alter table public.drivers add column if not exists rating_avg double precision;
alter table public.drivers add column if not exists rating_count integer not null default 0;

-- ---------- Commission payments drivers make to Mashi ----------
create table if not exists public.driver_payments (
  id          uuid primary key default gen_random_uuid(),
  driver_id   uuid not null references public.drivers(id) on delete cascade,
  amount_ssp  integer not null check (amount_ssp > 0),
  note        text,
  recorded_by uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);
alter table public.driver_payments enable row level security;
drop policy if exists driver_payments_select on public.driver_payments;
create policy driver_payments_select on public.driver_payments for select
  using (driver_id = auth.uid() or public.is_admin());

-- ---------- Request ride now locks the commission ----------
create or replace function public.request_ride(
  p_vehicle public.vehicle_type,
  p_pickup_lat float8, p_pickup_lng float8, p_pickup_note text,
  p_dropoff_lat float8, p_dropoff_lng float8, p_dropoff_note text,
  p_payment public.payment_method
) returns public.rides
language plpgsql security definer set search_path = public as $$
declare
  s        fare_settings;
  km       float8;
  fare     integer;
  cut      integer;
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

  fare := greatest(s.minimum_fare, (round((s.base_fare + s.per_km * km) / 100) * 100)::int);
  cut  := round(fare * s.commission_percent / 100)::int;

  insert into rides (rider_id, vehicle_type, pickup_lat, pickup_lng, pickup_note,
                     dropoff_lat, dropoff_lng, dropoff_note, distance_km, fare_ssp,
                     commission_ssp, driver_earnings_ssp, payment_method)
  values (auth.uid(), p_vehicle, p_pickup_lat, p_pickup_lng, nullif(trim(p_pickup_note), ''),
          p_dropoff_lat, p_dropoff_lng, nullif(trim(p_dropoff_note), ''), km, fare,
          cut, fare - cut, p_payment)
  returning * into new_ride;

  return new_ride;
end $$;

-- ---------- Rider rates the driver after the trip ----------
create or replace function public.rate_ride(p_ride uuid, p_stars integer) returns public.rides
language plpgsql security definer set search_path = public as $$
declare r rides;
begin
  if p_stars < 1 or p_stars > 5 then raise exception 'Choose between 1 and 5 stars'; end if;

  update rides set rider_rating = p_stars
   where id = p_ride and rider_id = auth.uid() and status = 'completed' and rider_rating is null
   returning * into r;
  if not found then raise exception 'This ride can''t be rated'; end if;

  update drivers
     set rating_avg = round(((coalesce(rating_avg, 0) * rating_count + p_stars) / (rating_count + 1))::numeric, 2)::float8,
         rating_count = rating_count + 1
   where id = r.driver_id;
  return r;
end $$;

-- ---------- Driver's own money summary ----------
create or replace function public.driver_summary() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'trips_today',     count(*) filter (where r.completed_at >= date_trunc('day', now() at time zone 'Africa/Juba') at time zone 'Africa/Juba'),
    'fares_today',     coalesce(sum(r.fare_ssp) filter (where r.completed_at >= date_trunc('day', now() at time zone 'Africa/Juba') at time zone 'Africa/Juba'), 0),
    'earnings_today',  coalesce(sum(r.driver_earnings_ssp) filter (where r.completed_at >= date_trunc('day', now() at time zone 'Africa/Juba') at time zone 'Africa/Juba'), 0),
    'commission_total', coalesce(sum(r.commission_ssp), 0),
    'paid_total',      (select coalesce(sum(amount_ssp), 0) from driver_payments where driver_id = auth.uid()),
    'owed',            coalesce(sum(r.commission_ssp), 0)
                       - (select coalesce(sum(amount_ssp), 0) from driver_payments where driver_id = auth.uid())
  )
  from rides r
  where r.driver_id = auth.uid() and r.status = 'completed';
$$;

-- ---------- Admin: what each driver owes Mashi ----------
create or replace function public.admin_driver_balances()
returns table (driver_id uuid, commission_total bigint, paid_total bigint, owed bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return query
    select d.id,
           coalesce((select sum(commission_ssp) from rides where rides.driver_id = d.id and status = 'completed'), 0)::bigint,
           coalesce((select sum(amount_ssp) from driver_payments p where p.driver_id = d.id), 0)::bigint,
           (coalesce((select sum(commission_ssp) from rides where rides.driver_id = d.id and status = 'completed'), 0)
            - coalesce((select sum(amount_ssp) from driver_payments p where p.driver_id = d.id), 0))::bigint
    from drivers d;
end $$;

create or replace function public.record_driver_payment(p_driver uuid, p_amount integer, p_note text)
returns public.driver_payments
language plpgsql security definer set search_path = public as $$
declare p driver_payments;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Enter an amount above 0'; end if;
  insert into driver_payments (driver_id, amount_ssp, note, recorded_by)
  values (p_driver, p_amount, nullif(trim(p_note), ''), auth.uid())
  returning * into p;
  return p;
end $$;
