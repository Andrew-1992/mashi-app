"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import { roadKm, type LatLng } from "@/lib/geo";
import { haptic } from "@/lib/haptics";
import {
  PAYMENT_LABEL,
  VEHICLE_LABEL,
  formatSSP,
  type Driver,
  type DriverSummary,
  type Ride,
  type RideStatus,
  type VehicleType,
} from "@/lib/types";
import type { Pin } from "@/components/MashiMap";
import { Button, Choice, ErrorNote, FullScreenMessage, Sheet, TopBar } from "@/components/ui";
import TripChat from "@/components/TripChat";

const MashiMap = dynamic(() => import("@/components/MashiMap"), { ssr: false });

/** Buzz and beep so drivers notice a new request with the phone in their pocket. */
function alertNewRequest() {
  try {
    navigator.vibrate?.([250, 120, 250]);
  } catch {
    /* vibration not supported */
  }
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [0, 0.25].forEach((start) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.25, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + 0.2);
    });
  } catch {
    /* audio blocked until the driver taps the screen */
  }
}

function directionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

const NEXT_STEP: Partial<Record<RideStatus, { to: RideStatus; label: (r: Ride) => string }>> = {
  accepted: { to: "arrived", label: () => "I've arrived at pickup" },
  arrived: { to: "in_progress", label: () => "Start trip" },
  in_progress: { to: "completed", label: (r) => `Complete trip and collect ${formatSSP(r.fare_ssp)}` },
};

export default function DriverPage() {
  const router = useRouter();
  const { loading, userId } = useProfile();

  const [me, setMe] = useState<Driver | null | undefined>(undefined);
  const [ride, setRide] = useState<Ride | null>(null);
  const [rider, setRider] = useState<{ full_name: string; phone: string } | null>(null);
  const [openRides, setOpenRides] = useState<Ride[]>([]);
  const [pos, setPos] = useState<LatLng | null>(null);
  const [gpsOk, setGpsOk] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<DriverSummary | null>(null);

  const [vehicle, setVehicle] = useState<VehicleType>("boda");
  const [plate, setPlate] = useState("");

  const lastSent = useRef(0);
  const seenRequests = useRef<Set<string>>(new Set());
  const prevRideId = useRef<string | null>(null);
  const finishedByMe = useRef(false);

  useEffect(() => {
    if (!loading && !userId) router.replace("/login?next=/driver");
  }, [loading, userId, router]);

  const loadMe = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from("drivers").select("*").eq("id", userId).maybeSingle();
    setMe((data as Driver) ?? null);
  }, [userId]);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const refreshRide = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("rides")
      .select("*")
      .eq("driver_id", userId)
      .in("status", ["accepted", "arrived", "in_progress"])
      .limit(1)
      .maybeSingle();
    const current = data as Ride | null;

    if (!current && prevRideId.current && !finishedByMe.current) {
      setNotice("The rider cancelled this ride.");
    }
    prevRideId.current = current?.id ?? null;
    finishedByMe.current = false;
    setRide(current);

    if (current) {
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", current.rider_id)
        .maybeSingle();
      setRider(p as { full_name: string; phone: string } | null);
    } else {
      setRider(null);
    }
  }, [userId]);

  const loadSummary = useCallback(async () => {
    const { data, error } = await supabase.rpc("driver_summary");
    if (!error && data) setSummary(data as DriverSummary);
  }, []);

  useEffect(() => {
    if (!me || me.status !== "verified") return;
    loadSummary();
    const t = setInterval(loadSummary, 30000);
    return () => clearInterval(t);
  }, [me, loadSummary]);

  const refreshOpen = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_open_rides");
    if (error) return;
    const list = (data ?? []) as Ride[];
    if (list.some((r) => !seenRequests.current.has(r.id))) alertNewRequest();
    seenRequests.current = new Set(list.map((r) => r.id));
    setOpenRides(list);
  }, []);

  const online = me?.is_online === true;

  // Poll for the current trip and nearby requests.
  useEffect(() => {
    if (!me || me.status !== "verified") return;
    const tick = () => {
      refreshRide();
      if (online) refreshOpen();
    };
    tick();
    const t = setInterval(tick, 5000);
    return () => clearInterval(t);
  }, [me, online, refreshRide, refreshOpen]);

  // Keep the screen on while online so requests and GPS keep flowing.
  useEffect(() => {
    if (!online || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        /* not allowed right now, e.g. battery saver */
      }
    };
    request();
    const onVisible = () => {
      if (document.visibilityState === "visible") request();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => undefined);
    };
  }, [online]);

  // Follow the phone's GPS while online.
  useEffect(() => {
    if (!online) return;
    if (!navigator.geolocation) {
      setGpsOk(false);
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setGpsOk(true);
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
      },
      () => setGpsOk(false),
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [online]);

  // Send location at most every 10 seconds to save data.
  useEffect(() => {
    if (!pos || !online) return;
    if (Date.now() - lastSent.current < 10000) return;
    lastSent.current = Date.now();
    supabase.rpc("update_driver_location", { p_lat: pos.lat, p_lng: pos.lng }).then(() => undefined);
  }, [pos, online]);

  const onPick = (lat: number, lng: number) => {
    // Without GPS (or when testing on a laptop), tap the map to set where you are.
    if (!online || gpsOk) return;
    lastSent.current = 0;
    setPos({ lat, lng });
  };

  const register = async () => {
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("register_driver", { p_vehicle: vehicle, p_plate: plate });
    setBusy(false);
    if (error) return setError(error.message);
    loadMe();
  };

  const toggleOnline = async () => {
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("set_driver_online", { p_online: !online });
    setBusy(false);
    if (error) return setError(error.message);
    lastSent.current = 0;
    if (online) setOpenRides([]);
    loadMe();
  };

  const accept = async (id: string) => {
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("accept_ride", { p_ride: id });
    setBusy(false);
    if (error) {
      setError(error.message);
      refreshOpen();
      return;
    }
    haptic(30);
    setOpenRides([]);
    refreshRide();
  };

  const advance = async () => {
    if (!ride) return;
    const next = NEXT_STEP[ride.status];
    if (!next) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("advance_ride", { p_ride: ride.id, p_status: next.to });
    setBusy(false);
    if (error) return setError(error.message);
    haptic();
    if (next.to === "completed") {
      finishedByMe.current = true;
      setNotice(
        `Trip complete. Collect ${formatSSP(ride.fare_ssp)} ${ride.payment_method === "cash" ? "in cash" : "by mobile money"}. ` +
          `You keep ${formatSSP(ride.driver_earnings_ssp)}; Mashi's commission is ${formatSSP(ride.commission_ssp)}.`,
      );
      loadSummary();
    }
    refreshRide();
  };

  const release = async () => {
    if (!ride) return;
    setBusy(true);
    const { error } = await supabase.rpc("cancel_ride", { p_ride: ride.id });
    setBusy(false);
    if (error) return setError(error.message);
    finishedByMe.current = true;
    refreshRide();
  };

  const pins = useMemo<Pin[]>(() => {
    const list: Pin[] = [];
    if (pos) list.push({ kind: "driver", ...pos });
    if (ride) {
      list.push({ kind: "pickup", lat: ride.pickup_lat, lng: ride.pickup_lng });
      list.push({ kind: "dropoff", lat: ride.dropoff_lat, lng: ride.dropoff_lng });
    } else {
      for (const r of openRides) list.push({ kind: "pickup", lat: r.pickup_lat, lng: r.pickup_lng });
    }
    return list;
  }, [pos, ride, openRides]);

  const fitKey = ride ? `ride-${ride.id}-${ride.status}` : `open-${openRides.map((r) => r.id).join(",")}-${pos ? "p" : ""}`;

  if (loading || !userId || me === undefined) {
    return (
      <FullScreenMessage>
        <p className="wide text-3xl font-black">Mashi</p>
      </FullScreenMessage>
    );
  }

  if (me === null) {
    return (
      <main className="flex min-h-full flex-col">
        <div className="px-6 pt-10 pb-6">
          <p className="wide text-5xl font-black">Mashi</p>
          <p className="mt-2 text-ink-soft">Drive with Mashi and get riders across Juba.</p>
        </div>
        <div className="vest flex-1 bg-vest px-6 pt-12 pb-10">
          <div className="mx-auto flex max-w-md flex-col gap-4">
            <h1 className="wide text-2xl font-extrabold">Register your vehicle</h1>
            <ErrorNote message={error} onClose={() => setError(null)} />
            <div role="radiogroup" aria-label="Vehicle type" className="flex gap-2">
              {(["boda", "tuktuk", "car"] as VehicleType[]).map((v) => (
                <Choice key={v} selected={vehicle === v} onClick={() => setVehicle(v)}>
                  <span className="block text-center font-bold">{VEHICLE_LABEL[v]}</span>
                </Choice>
              ))}
            </div>
            <label className="text-sm font-semibold">
              Plate number
              <input
                className="mt-1 w-full rounded-xl bg-white px-4 py-3 text-base uppercase"
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                placeholder="e.g. SSD 123A"
              />
            </label>
            <Button disabled={busy} onClick={register}>
              {busy ? "Sending…" : "Send for verification"}
            </Button>
            <p className="text-sm text-ink-soft">
              Mashi will check your ID, licence and vehicle papers before you can accept rides.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (me.status !== "verified") {
    return (
      <main className="relative flex min-h-full flex-col">
        <TopBar />
        <FullScreenMessage>
          <h1 className="wide text-3xl font-extrabold">
            {me.status === "pending" ? "You're almost ready to drive" : "Your account is on hold"}
          </h1>
          <p className="mt-3 text-ink-soft">
            {me.status === "pending"
              ? `We received your ${VEHICLE_LABEL[me.vehicle_type].toLowerCase()} with plate ${me.plate_number}. Mashi will contact you to check your ID, licence and vehicle papers.`
              : "Contact Mashi support to find out why and how to get back on the road."}
          </p>
          <Button variant="quiet" className="mt-6" onClick={loadMe}>
            Check again
          </Button>
        </FullScreenMessage>
      </main>
    );
  }

  return (
    <main className="relative h-dvh overflow-hidden">
      <MashiMap pins={pins} onPick={onPick} fitKey={fitKey} />
      <TopBar title={online ? "Online" : "Offline"} />

      <Sheet expandKey={`${ride?.id ?? ""}-${ride?.status ?? ""}-${openRides.length}-${notice ?? ""}-${error ?? ""}`}>
        <ErrorNote message={error} onClose={() => setError(null)} />
        {notice && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-xl bg-white px-4 py-3 text-sm font-semibold" role="status">
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} aria-label="Dismiss">
              ✕
            </button>
          </div>
        )}

        {ride ? (
          <div className="flex flex-col gap-4">
            <h2 className="wide text-2xl font-extrabold">
              {ride.status === "in_progress" ? "Take the rider to drop-off" : "Pick up your rider"}
            </h2>
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-4 py-3">
              <div>
                <p className="font-bold">{rider?.full_name || "Rider"}</p>
                <p className="text-sm text-ink-soft">
                  {ride.status === "in_progress"
                    ? ride.dropoff_note || "Drop-off pin on the map"
                    : ride.pickup_note || "Pickup pin on the map"}
                </p>
              </div>
              {rider?.phone && (
                <a href={`tel:${rider.phone}`} className="rounded-xl bg-ink px-4 py-3 font-bold text-white">
                  Call
                </a>
              )}
            </div>
            <TripChat
              rideId={ride.id}
              userId={userId}
              otherName={rider?.full_name?.split(" ")[0] || "Rider"}
              quickReplies={["I'm on my way", "I've arrived", "I'm at the gate", "Traffic, 5 minutes", "Where exactly are you?"]}
            />
            <div className="flex items-baseline justify-between rounded-2xl bg-white/70 px-4 py-3">
              <span className="font-semibold">
                {PAYMENT_LABEL[ride.payment_method]}, {ride.distance_km.toFixed(1)} km
                <span className="block text-sm font-normal text-ink-soft">You keep {formatSSP(ride.driver_earnings_ssp)}</span>
              </span>
              <span className="wide text-xl font-black">{formatSSP(ride.fare_ssp)}</span>
            </div>
            <a
              href={
                ride.status === "in_progress"
                  ? directionsUrl(ride.dropoff_lat, ride.dropoff_lng)
                  : directionsUrl(ride.pickup_lat, ride.pickup_lng)
              }
              target="_blank"
              rel="noreferrer"
              className="flex h-12 items-center justify-center rounded-2xl bg-white/70 font-bold ring-2 ring-ink/80"
            >
              {ride.status === "in_progress" ? "Navigate to drop-off" : "Navigate to pickup"}
            </a>
            {NEXT_STEP[ride.status] && (
              <Button disabled={busy} onClick={advance}>
                {NEXT_STEP[ride.status]!.label(ride)}
              </Button>
            )}
            {ride.status !== "in_progress" && (
              <Button variant="danger" disabled={busy} onClick={release}>
                Release ride to other drivers
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="wide text-2xl font-extrabold">
                {online ? (openRides.length ? "Ride requests near you" : "Waiting for requests") : "You're offline"}
              </h2>
              <span className="text-sm font-semibold text-ink-soft">
                {me.rating_avg != null ? `★ ${me.rating_avg.toFixed(1)}, ` : ""}
                {me.trips_completed} trips
              </span>
            </div>

            {summary && (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-white/70 px-2 py-3">
                  <p className="text-xs font-semibold text-ink-soft">Trips today</p>
                  <p className="wide text-lg font-black">{summary.trips_today}</p>
                </div>
                <div className="rounded-2xl bg-white/70 px-2 py-3">
                  <p className="text-xs font-semibold text-ink-soft">You earned today</p>
                  <p className="wide text-lg font-black">{formatSSP(summary.earnings_today)}</p>
                </div>
                <div className={`rounded-2xl px-2 py-3 ${summary.owed > 0 ? "bg-ink text-white" : "bg-white/70"}`}>
                  <p className={`text-xs font-semibold ${summary.owed > 0 ? "text-white/70" : "text-ink-soft"}`}>Owed to Mashi</p>
                  <p className="wide text-lg font-black">{formatSSP(Math.max(0, summary.owed))}</p>
                </div>
              </div>
            )}

            {online && !gpsOk && (
              <p className="rounded-xl bg-white px-4 py-3 text-sm font-medium">
                GPS is off. Turn on location, or tap the map to show riders where you are.
              </p>
            )}

            {online &&
              openRides.map((r) => (
                <div key={r.id} className="rounded-2xl bg-white/80 p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="wide text-xl font-black">{formatSSP(r.fare_ssp)}</span>
                    <span className="text-sm font-semibold text-ink-soft">{PAYMENT_LABEL[r.payment_method]}</span>
                  </div>
                  <p className="text-sm font-semibold text-nile">You keep {formatSSP(r.driver_earnings_ssp)}</p>
                  <p className="mt-1 text-sm">
                    {pos ? `${roadKm(pos, { lat: r.pickup_lat, lng: r.pickup_lng }).toFixed(1)} km to pickup, ` : ""}
                    {r.distance_km.toFixed(1)} km trip
                  </p>
                  {r.pickup_note && <p className="mt-1 text-sm text-ink-soft">Pickup: {r.pickup_note}</p>}
                  {r.dropoff_note && <p className="text-sm text-ink-soft">Drop-off: {r.dropoff_note}</p>}
                  <Button className="mt-3 h-12" disabled={busy} onClick={() => accept(r.id)}>
                    Accept ride
                  </Button>
                </div>
              ))}

            <Button variant={online ? "quiet" : "primary"} disabled={busy} onClick={toggleOnline}>
              {online ? "Go offline" : "Go online"}
            </Button>
          </div>
        )}
      </Sheet>
    </main>
  );
}
