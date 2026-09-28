"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { roadKm } from "@/lib/geo";
import { etaMinutes } from "@/lib/places";
import { VEHICLE_LABEL, type RideStatus, type VehicleType } from "@/lib/types";
import type { Pin } from "@/components/MashiMap";
import { Sheet } from "@/components/ui";
import { VEHICLE_ICON } from "@/components/rider/RideOptions";

const MashiMap = dynamic(() => import("@/components/MashiMap"), { ssr: false });

type SharedTrip = {
  status: RideStatus;
  vehicle_type: VehicleType;
  pickup_lat: number;
  pickup_lng: number;
  pickup_note: string | null;
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_note: string | null;
  rider_first_name: string;
  driver_first_name: string | null;
  plate_number: string | null;
  driver_lat: number | null;
  driver_lng: number | null;
  location_updated_at: string | null;
};

/** Public page family and friends open from a shared link. No sign-in needed. */
export default function TrackPage() {
  const { token } = useParams<{ token: string }>();
  const [trip, setTrip] = useState<SharedTrip | null | undefined>(undefined);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.rpc("get_shared_trip", { p_token: token });
      setTrip(error ? null : ((data as SharedTrip | null) ?? null));
    };
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [token]);

  const pins = useMemo<Pin[]>(() => {
    if (!trip) return [];
    const list: Pin[] = [
      { kind: "pickup", lat: trip.pickup_lat, lng: trip.pickup_lng },
      { kind: "dropoff", lat: trip.dropoff_lat, lng: trip.dropoff_lng },
    ];
    if (trip.driver_lat != null && trip.driver_lng != null) {
      list.push({ kind: "driver", lat: trip.driver_lat, lng: trip.driver_lng, icon: VEHICLE_ICON[trip.vehicle_type] });
    }
    return list;
  }, [trip]);

  const rider = trip?.rider_first_name || "Your friend";
  const driver = trip?.driver_first_name || "the driver";
  let heading = "";
  let eta: number | null = null;
  if (trip) {
    if (trip.driver_lat != null && trip.driver_lng != null && (trip.status === "accepted" || trip.status === "in_progress")) {
      const target =
        trip.status === "in_progress" ? { lat: trip.dropoff_lat, lng: trip.dropoff_lng } : { lat: trip.pickup_lat, lng: trip.pickup_lng };
      eta = etaMinutes(roadKm({ lat: trip.driver_lat, lng: trip.driver_lng }, target));
    }
    heading = {
      requested: `${rider} is waiting for a driver`,
      accepted: `${driver} is picking up ${rider}`,
      arrived: `${driver} has reached ${rider}`,
      in_progress: `${rider} is on the way`,
      completed: `${rider} has arrived safely`,
      cancelled: "This trip was cancelled",
    }[trip.status];
  }

  const updated =
    trip?.location_updated_at != null
      ? Math.max(0, Math.round((Date.now() - new Date(trip.location_updated_at).getTime()) / 60000))
      : null;

  return (
    <main className="relative h-dvh overflow-hidden">
      <MashiMap pins={pins} fitKey={trip ? `${trip.status}-${trip.driver_lat != null}` : undefined} />
      <header className="absolute inset-x-0 top-0 z-[500] flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link href="/" className="wide rounded-[50%] bg-vest px-5 py-2 text-lg font-black text-ink shadow-md">
          Mashi
        </Link>
        <span className="rounded-full bg-white px-3 py-2 text-sm font-semibold shadow-md">
          <span aria-hidden="true">📍</span> Live trip
        </span>
      </header>

      <Sheet>
        {trip === undefined ? (
          <p className="wide text-xl font-extrabold">Loading trip…</p>
        ) : trip === null ? (
          <div className="flex flex-col gap-3">
            <h1 className="wide text-2xl font-extrabold">This trip link has ended</h1>
            <p className="text-ink-soft">Live links stop working an hour after the trip finishes.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4" aria-live="polite">
            <h1 className="wide text-2xl font-extrabold">{heading}</h1>
            {eta && (
              <p className="text-lg font-semibold">
                {trip.status === "in_progress" ? `About ${eta} min to ${trip.dropoff_note || "drop-off"}` : `Driver about ${eta} min away`}
              </p>
            )}
            {trip.plate_number && (
              <div className="flex items-center gap-3 rounded-2xl bg-white/80 p-4">
                <span className="flex size-12 items-center justify-center rounded-full bg-vest text-2xl" aria-hidden="true">
                  {VEHICLE_ICON[trip.vehicle_type]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{trip.driver_first_name}</p>
                  <p className="text-sm text-ink-soft">{VEHICLE_LABEL[trip.vehicle_type]}</p>
                </div>
                <span className="wide rounded-lg bg-ink px-3 py-2 font-black text-vest">{trip.plate_number}</span>
              </div>
            )}
            <p className="text-sm text-ink-soft">
              To: {trip.dropoff_note || "drop-off pin on the map"}
              {updated != null && trip.driver_lat != null ? `. Location updated ${updated === 0 ? "just now" : `${updated} min ago`}.` : ""}
            </p>
          </div>
        )}
      </Sheet>
    </main>
  );
}
