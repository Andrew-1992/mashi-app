-- Mashi update 004: live trip sharing, emergency contact, in-trip chat
-- Run once in Supabase SQL Editor after 003.

-- ---------- Live trip link ----------
alter table public.rides add column if not exists share_token uuid not null default gen_random_uuid();
create unique index if not exists rides_share_token_idx on public.rides (share_token);

-- Anyone with the link can follow the trip, without signing in, while it is active
-- and for one hour after it ends. Only first names and the plate are shown.
create or replace function public.get_shared_trip(p_token uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'status', r.status,
    'vehicle_type', r.vehicle_type,
    'pickup_lat', r.pickup_lat, 'pickup_lng', r.pickup_lng, 'pickup_note', r.pickup_note,
    'dropoff_lat', r.dropoff_lat, 'dropoff_lng', r.dropoff_lng, 'dropoff_note', r.dropoff_note,
    'rider_first_name', split_part(rp.full_name, ' ', 1),
    'driver_first_name', split_part(dp.full_name, ' ', 1),
    'plate_number', d.plate_number,
    'driver_lat', case when r.status in ('accepted','arrived','in_progress') then d.lat end,
    'driver_lng', case when r.status in ('accepted','arrived','in_progress') then d.lng end,
    'location_updated_at', d.location_updated_at,
    'completed_at', r.completed_at
  )
  from rides r
  join profiles rp on rp.id = r.rider_id
  left join drivers d on d.id = r.driver_id
  left join profiles dp on dp.id = r.driver_id
  where r.share_token = p_token
    and (r.status in ('requested','accepted','arrived','in_progress')
         or (r.status = 'completed' and r.completed_at > now() - interval '1 hour'));
$$;
grant execute on function public.get_shared_trip(uuid) to anon, authenticated;

-- ---------- Emergency contact ----------
alter table public.profiles add column if not exists emergency_name text;
alter table public.profiles add column if not exists emergency_phone text;

create or replace function public.set_emergency_contact(p_name text, p_phone text) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare p profiles;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) < 7 then
    raise exception 'Enter a full phone number, e.g. +211 9xx xxx xxx';
  end if;
  update profiles set emergency_name = nullif(trim(p_name), ''), emergency_phone = trim(p_phone)
   where id = auth.uid()
   returning * into p;
  return p;
end $$;

-- Lets a signed-in user update their own name and phone (role stays admin-only).
create or replace function public.update_my_profile(p_full_name text, p_phone text) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare p profiles;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if length(trim(coalesce(p_full_name, ''))) < 2 then raise exception 'Enter your name'; end if;
  update profiles set full_name = trim(p_full_name), phone = trim(coalesce(p_phone, ''))
   where id = auth.uid()
   returning * into p;
  return p;
end $$;

-- ---------- In-trip chat ----------
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  ride_id    uuid not null references public.rides(id) on delete cascade,
  sender_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists messages_ride_idx on public.messages (ride_id, created_at);

alter table public.messages enable row level security;
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select using (
  public.is_admin() or exists (
    select 1 from public.rides r
    where r.id = messages.ride_id and (r.rider_id = auth.uid() or r.driver_id = auth.uid())
  )
);

create or replace function public.send_message(p_ride uuid, p_body text) returns public.messages
language plpgsql security definer set search_path = public as $$
declare m messages;
begin
  if length(trim(coalesce(p_body, ''))) = 0 then raise exception 'Type a message first'; end if;
  if not exists (
    select 1 from rides
    where id = p_ride and status in ('accepted','arrived','in_progress')
      and (rider_id = auth.uid() or driver_id = auth.uid())
  ) then
    raise exception 'Chat is only open during an active trip';
  end if;
  insert into messages (ride_id, sender_id, body) values (p_ride, auth.uid(), left(trim(p_body), 500))
  returning * into m;
  return m;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;
