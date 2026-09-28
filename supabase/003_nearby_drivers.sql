-- Mashi update 003: live driver availability for the ride options screen
-- Run once in Supabase SQL Editor after 002. Returns counts and distances only, never driver positions.

create or replace function public.nearby_drivers(p_lat float8, p_lng float8)
returns table (vehicle_type public.vehicle_type, drivers integer, nearest_km float8)
language sql stable security definer set search_path = public as $$
  select d.vehicle_type,
         count(*)::int,
         min(road_distance_km(p_lat, p_lng, d.lat, d.lng))
  from drivers d
  where d.status = 'verified' and d.is_online and d.lat is not null
    and d.location_updated_at > now() - interval '10 minutes'
    and road_distance_km(p_lat, p_lng, d.lat, d.lng) <= 10
    and not exists (select 1 from rides x where x.driver_id = d.id
                    and x.status in ('accepted','arrived','in_progress'))
  group by d.vehicle_type;
$$;
