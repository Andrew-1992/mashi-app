"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import { roadKm } from "@/lib/geo";
import { loadSaved, reverseLabel, storeSaved, type Place, type SavedPlaces } from "@/lib/places";
import { ACTIVE_STATUSES, type FareSetting, type PaymentMethod, type Ride, type VehicleType } from "@/lib/types";
import type { Pin } from "@/components/MashiMap";
import { Button, ErrorNote, FullScreenMessage, Sheet, TopBar } from "@/components/ui";
import SearchPanel, { type Field, type MapTarget } from "@/components/rider/SearchPanel";
import RideOptions, { VEHICLE_ICON, type Nearby } from "@/components/rider/RideOptions";
import TripStatus, { type DriverInfo } from "@/components/rider/TripStatus";

const MashiMap = dynamic(() => import("@/components/MashiMap"), { ssr: false });

type Mode = "home" | "search" | "pinpick" | "options";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function RiderPage() {
  const router = useRouter();
  const { loading, userId, profile } = useProfile();

  const [fares, setFares] = useState<FareSetting[]>([]);
  const [latestRide, setRide] = useState<Ride | null>(null);
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const [recents, setRecents] = useState<Place[]>([]);
  const [saved, setSaved] = useState<SavedPlaces>({});
  const [nearby, setNearby] = useState<Nearby>({});

  const [mode, setMode] = useState<Mode>("home");
  const [field, setField] = useState<Field>("dropoff");
  const [pinTarget, setPinTarget] = useState<MapTarget>("pickup");
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [centerLabel, setCenterLabel] = useState("Move the map to set the pin");
  const [focus, setFocus] = useState<{ lat: number; lng: number; key: string } | undefined>();

  const [pickup, setPickup] = useState<Place | null>(null);
  const [dropoff, setDropoff] = useState<Place | null>(null);
  const [vehicle, setVehicle] = useState<VehicleType>("boda");
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ride = latestRide && latestRide.id !== dismissedId ? latestRide : null;
  const rideActive = ride !== null && ACTIVE_STATUSES.includes(ride.status);

  useEffect(() => {
    if (!loading && !userId) router.replace("/login?next=/rider");
  }, [loading, userId, router]);

  // ---------- Data ----------
  useEffect(() => {
    if (!userId) return;
    setSaved(loadSaved(userId));
    supabase
      .from("fare_settings")
      .select("*")
      .eq("active", true)
      .order("base_fare")
      .then(({ data }) => {
        const list = (data ?? []) as FareSetting[];
        setFares(list);
        if (list.length && !list.some((f) => f.vehicle_type === "boda")) setVehicle(list[0].vehicle_type);
      });
  }, [userId]);

  const loadRecents = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("rides")
      .select("dropoff_lat, dropoff_lng, dropoff_note")
      .eq("rider_id", userId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(15);
    const seen = new Set<string>();
    const list: Place[] = [];
    for (const r of (data ?? []) as { dropoff_lat: number; dropoff_lng: number; dropoff_note: string | null }[]) {
      const label = r.dropoff_note || "Dropped pin";
      const key = label + Math.round(r.dropoff_lat * 1000) + Math.round(r.dropoff_lng * 1000);
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({ label, lat: r.dropoff_lat, lng: r.dropoff_lng });
      if (list.length === 4) break;
    }
    setRecents(list);
  }, [userId]);

  useEffect(() => {
    loadRecents();
  }, [loadRecents]);

  const refreshRide = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("rides")
      .select("*")
      .eq("rider_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const r = data as Ride | null;
    const recentlyCompleted =
      r?.status === "completed" && r.completed_at !== null && Date.now() - new Date(r.completed_at).getTime() < 30 * 60 * 1000;
    const show = r && (ACTIVE_STATUSES.includes(r.status) || recentlyCompleted) ? r : null;
    setRide(show);

    if (show?.driver_id && ACTIVE_STATUSES.includes(show.status)) {
      const { data: d } = await supabase
        .from("drivers")
        .select("plate_number, vehicle_type, lat, lng, trips_completed, rating_avg, rating_count, profiles(full_name, phone)")
        .eq("id", show.driver_id)
        .maybeSingle();
      if (d) setDriver(d as unknown as DriverInfo);
    } else if (!show) {
      setDriver(null);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    refreshRide();
    const channel = supabase
      .channel(`rider-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rides", filter: `rider_id=eq.${userId}` }, () => refreshRide())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refreshRide]);

  useEffect(() => {
    if (!rideActive) return;
    const t = setInterval(refreshRide, 5000);
    return () => clearInterval(t);
  }, [rideActive, refreshRide]);

  // Live availability for the options screen.
  useEffect(() => {
    if (mode !== "options" || !pickup) return;
    const load = async () => {
      const { data } = await supabase.rpc("nearby_drivers", { p_lat: pickup.lat, p_lng: pickup.lng });
      const next: Nearby = {};
      for (const row of (data ?? []) as { vehicle_type: VehicleType; drivers: number; nearest_km: number }[]) {
        next[row.vehicle_type] = { drivers: row.drivers, nearest_km: row.nearest_km };
      }
      setNearby(next);
    };
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [mode, pickup]);

  // ---------- Location ----------
  const locate = useCallback((quiet = false) => {
    if (!navigator.geolocation) {
      if (!quiet) setError("Location isn't available on this device. Search for your pickup or choose it on the map.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPickup({ label: "Current location", ...here });
        setFocus({ ...here, key: `me-${Date.now()}` });
        const label = await reverseLabel(here);
        setPickup((p) => (p && p.lat === here.lat && p.lng === here.lng ? { ...p, label } : p));
      },
      () => {
        if (!quiet) setError("Couldn't find your location. Search for your pickup or choose it on the map.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  useEffect(() => {
    if (userId) locate(true);
  }, [userId, locate]);

  // Name the spot under the centre pin while choosing on the map.
  useEffect(() => {
    if (mode !== "pinpick" || !center) return;
    const ctrl = new AbortController();
    setCenterLabel("Finding address…");
    const t = setTimeout(async () => {
      const label = await reverseLabel(center, ctrl.signal);
      if (!ctrl.signal.aborted) setCenterLabel(label);
    }, 600);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [mode, center]);

  // ---------- Flow ----------
  const goOptions = (p: Place | null, d: Place | null) => {
    if (!p) {
      setField("pickup");
      setMode("search");
      return;
    }
    if (!d) {
      setField("dropoff");
      setMode("search");
      return;
    }
    setMode("options");
  };

  const selectPlace = (place: Place, f: Field) => {
    if (f === "pickup") {
      setPickup(place);
      if (dropoff) goOptions(place, dropoff);
      else setField("dropoff");
    } else {
      setDropoff(place);
      goOptions(pickup, place);
    }
  };

  const chooseOnMap = (target: MapTarget) => {
    setPinTarget(target);
    const start =
      (target === "pickup" && pickup) || (target === "dropoff" && dropoff) || saved[target as "home" | "work"] || pickup || null;
    if (start) setFocus({ lat: start.lat, lng: start.lng, key: `pin-${target}-${Date.now()}` });
    setMode("pinpick");
  };

  const confirmPin = () => {
    if (!center) return;
    const place: Place = { label: centerLabel.endsWith("…") ? "Pinned location" : centerLabel, ...center };
    if (pinTarget === "home" || pinTarget === "work") {
      const next = { ...saved, [pinTarget]: place };
      setSaved(next);
      if (userId) storeSaved(userId, next);
      setMode("search");
      return;
    }
    selectPlace(place, pinTarget);
    if (pinTarget === "pickup" && !dropoff) setMode("search");
  };

  const quickGo = (place: Place) => {
    setDropoff(place);
    goOptions(pickup, place);
  };

  const requestRide = async () => {
    if (!pickup || !dropoff) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("request_ride", {
      p_vehicle: vehicle,
      p_pickup_lat: pickup.lat,
      p_pickup_lng: pickup.lng,
      p_pickup_note: note.trim() ? `${pickup.label}. ${note.trim()}` : pickup.label,
      p_dropoff_lat: dropoff.lat,
      p_dropoff_lng: dropoff.lng,
      p_dropoff_note: dropoff.label,
      p_payment: payment,
    });
    setBusy(false);
    if (error) return setError(error.message);
    setNote("");
    refreshRide();
  };

  const cancelRide = async () => {
    if (!ride) return;
    setBusy(true);
    const { error } = await supabase.rpc("cancel_ride", { p_ride: ride.id });
    setBusy(false);
    if (error) return setError(error.message);
    refreshRide();
  };

  const rateRide = async (stars: number) => {
    if (!ride) return;
    const { error } = await supabase.rpc("rate_ride", { p_ride: ride.id, p_stars: stars });
    if (error) return setError(error.message);
    refreshRide();
  };

  const bookAnother = () => {
    if (ride) setDismissedId(ride.id);
    setDriver(null);
    setDropoff(null);
    setMode("home");
    loadRecents();
  };

  // ---------- Map ----------
  const km = pickup && dropoff ? roadKm(pickup, dropoff) : 0;

  const pins = useMemo<Pin[]>(() => {
    if (ride) {
      const list: Pin[] = [
        { kind: "pickup", lat: ride.pickup_lat, lng: ride.pickup_lng, pulse: ride.status === "requested" },
        { kind: "dropoff", lat: ride.dropoff_lat, lng: ride.dropoff_lng },
      ];
      if (driver?.lat != null && driver.lng != null && rideActive) {
        list.push({ kind: "driver", lat: driver.lat, lng: driver.lng, icon: VEHICLE_ICON[driver.vehicle_type] });
      }
      return list;
    }
    if (mode === "pinpick") return [];
    const list: Pin[] = [];
    if (pickup) list.push({ kind: "pickup", ...pickup });
    if (dropoff && mode === "options") list.push({ kind: "dropoff", ...dropoff });
    return list;
  }, [ride, driver, rideActive, mode, pickup, dropoff]);

  const fitKey = ride
    ? `ride-${ride.id}-${ride.status}-${driver ? "d" : ""}`
    : mode === "options"
      ? `opt-${pickup?.lat}-${dropoff?.lat}`
      : undefined;

  if (loading || !userId) {
    return (
      <FullScreenMessage>
        <p className="wide text-3xl font-black">Mashi</p>
      </FullScreenMessage>
    );
  }

  const firstName = profile?.full_name?.split(" ")[0];
  const quick: { key: string; icon: string; place?: Place; label: string; target?: MapTarget }[] = [
    { key: "home", icon: "🏠", place: saved.home, label: "Home", target: "home" },
    { key: "work", icon: "💼", place: saved.work, label: "Work", target: "work" },
    ...recents.slice(0, 3).map((p, i) => ({ key: `r${i}`, icon: "🕘", place: p, label: p.label })),
  ];

  return (
    <main className="relative h-dvh overflow-hidden">
      <MashiMap
        pins={pins}
        fitKey={fitKey}
        centerMode={mode === "pinpick" && !ride}
        onCenter={(lat, lng) => setCenter({ lat, lng })}
        focus={focus}
      />
      <TopBar />

      {mode === "search" && !ride && (
        <SearchPanel
          field={field}
          pickup={pickup}
          dropoff={dropoff}
          saved={saved}
          recents={recents}
          onField={setField}
          onSelect={selectPlace}
          onUseMyLocation={() => {
            locate(false);
            setField("dropoff");
          }}
          onChooseOnMap={chooseOnMap}
          onClose={() => setMode(dropoff && pickup ? "options" : "home")}
        />
      )}

      <Sheet>
        <ErrorNote message={error} onClose={() => setError(null)} />

        {ride ? (
          <TripStatus ride={ride} driver={driver} busy={busy} onCancel={cancelRide} onDone={bookAnother} onRate={rateRide} />
        ) : mode === "pinpick" ? (
          <div className="mashi-step flex flex-col gap-3">
            <p className="text-sm font-semibold text-ink-soft">
              {pinTarget === "pickup"
                ? "Move the map to your pickup spot"
                : pinTarget === "dropoff"
                  ? "Move the map to your drop-off"
                  : `Move the map to your ${pinTarget}`}
            </p>
            <p className="wide truncate text-xl font-extrabold" aria-live="polite">
              {centerLabel}
            </p>
            <div className="flex gap-3">
              <Button variant="quiet" className="basis-1/3" onClick={() => setMode(pinTarget === "home" || pinTarget === "work" ? "search" : dropoff ? "options" : "search")}>
                Back
              </Button>
              <Button disabled={!center} onClick={confirmPin}>
                {pinTarget === "pickup"
                  ? "Confirm pickup"
                  : pinTarget === "dropoff"
                    ? "Confirm drop-off"
                    : `Save as ${pinTarget === "home" ? "Home" : "Work"}`}
              </Button>
            </div>
          </div>
        ) : mode === "options" && pickup && dropoff ? (
          <RideOptions
            pickup={pickup}
            dropoff={dropoff}
            km={km}
            fares={fares}
            nearby={nearby}
            vehicle={vehicle}
            payment={payment}
            note={note}
            busy={busy}
            onVehicle={setVehicle}
            onPayment={setPayment}
            onNote={setNote}
            onEdit={() => {
              setField("dropoff");
              setMode("search");
            }}
            onConfirm={requestRide}
          />
        ) : (
          <div className="mashi-step flex flex-col gap-4">
            <h2 className="wide text-2xl font-extrabold">
              {greeting()}
              {firstName ? `, ${firstName}` : ""}
            </h2>

            <button
              onClick={() => {
                setField("dropoff");
                setMode("search");
              }}
              className="flex h-14 items-center gap-3 rounded-2xl bg-white px-4 text-left text-lg font-bold shadow-sm"
            >
              <span className="size-3 bg-ink" aria-hidden="true" />
              Where to?
            </button>

            <button
              onClick={() => {
                setField("pickup");
                setMode("search");
              }}
              className="flex items-center gap-3 text-left"
            >
              <span className="size-3 shrink-0 rounded-full bg-nile" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-ink-soft">Pickup</span>
                <span className="block truncate font-semibold">{pickup?.label ?? "Set your pickup"}</span>
              </span>
            </button>

            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
              {quick.map((q) => (
                <button
                  key={q.key}
                  onClick={() => (q.place ? quickGo(q.place) : q.target && chooseOnMap(q.target))}
                  className="flex shrink-0 items-center gap-2 rounded-full bg-white/70 px-4 py-2 font-semibold"
                >
                  <span aria-hidden="true">{q.icon}</span>
                  <span className="max-w-40 truncate">{q.place ? q.label : `Set ${q.label.toLowerCase()}`}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Sheet>
    </main>
  );
}
