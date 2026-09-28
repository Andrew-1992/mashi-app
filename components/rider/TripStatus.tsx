"use client";

import { roadKm } from "@/lib/geo";
import { etaMinutes } from "@/lib/places";
import { PAYMENT_LABEL, VEHICLE_LABEL, formatSSP, type Ride, type RideStatus, type VehicleType } from "@/lib/types";
import { Button } from "@/components/ui";
import { VEHICLE_ICON } from "./RideOptions";

export type DriverInfo = {
  plate_number: string;
  vehicle_type: VehicleType;
  lat: number | null;
  lng: number | null;
  trips_completed: number;
  rating_avg: number | null;
  rating_count: number;
  profiles: { full_name: string; phone: string } | null;
};

const STEPS: { status: RideStatus; label: string }[] = [
  { status: "accepted", label: "On the way" },
  { status: "arrived", label: "At pickup" },
  { status: "in_progress", label: "On trip" },
  { status: "completed", label: "Arrived" },
];

type Props = {
  ride: Ride;
  driver: DriverInfo | null;
  busy: boolean;
  onCancel: () => void;
  onDone: () => void;
  onRate: (stars: number) => void;
};

export default function TripStatus({ ride, driver, busy, onCancel, onDone, onRate }: Props) {
  const name = driver?.profiles?.full_name || "Your driver";
  const firstName = name.split(" ")[0];
  const phone = driver?.profiles?.phone;
  const stale = ride.status === "requested" && Date.now() - new Date(ride.created_at).getTime() > 15 * 60 * 1000;
  const canCancel = ["requested", "accepted", "arrived"].includes(ride.status);
  const hasDriver = driver != null && ["accepted", "arrived", "in_progress"].includes(ride.status);
  const stepIndex = STEPS.findIndex((s) => s.status === ride.status);

  // Live ETA from the driver's last known position.
  let eta: number | null = null;
  if (driver?.lat != null && driver.lng != null) {
    const target =
      ride.status === "in_progress"
        ? { lat: ride.dropoff_lat, lng: ride.dropoff_lng }
        : { lat: ride.pickup_lat, lng: ride.pickup_lng };
    if (ride.status === "accepted" || ride.status === "in_progress") eta = etaMinutes(roadKm({ lat: driver.lat, lng: driver.lng }, target));
  }

  const dropoffName = ride.dropoff_note || "your drop-off";

  const heading = {
    requested: stale ? "No driver took this ride" : "Finding your driver",
    accepted: eta ? `${firstName} arrives in about ${eta} min` : `${firstName} is on the way`,
    arrived: `${firstName} is at the pickup`,
    in_progress: eta ? `About ${eta} min to ${dropoffName}` : `On the way to ${dropoffName}`,
    completed: "You've arrived",
    cancelled: "Ride cancelled",
  }[ride.status];

  const shareText = driver
    ? `I'm on a Mashi ${VEHICLE_LABEL[driver.vehicle_type].toLowerCase()} with ${name}, plate ${driver.plate_number}` +
      `${phone ? ` (${phone})` : ""}. From: ${ride.pickup_note || "my pickup point"}. To: ${dropoffName}. ` +
      `Pickup location: https://maps.google.com/?q=${ride.pickup_lat},${ride.pickup_lng}`
    : "";

  if (ride.status === "completed") {
    return (
      <div className="mashi-step flex flex-col gap-4" aria-live="polite">
        <h2 className="wide text-2xl font-extrabold">{heading}</h2>
        <div className="rounded-2xl bg-white/80 p-4">
          <div className="flex items-baseline justify-between">
            <span className="font-semibold">Pay your driver {ride.payment_method === "cash" ? "in cash" : "by mobile money"}</span>
            <span className="wide text-2xl font-black">{formatSSP(ride.fare_ssp)}</span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm text-ink-soft">
            <dt>Trip</dt>
            <dd className="text-right">{ride.distance_km.toFixed(1)} km by {VEHICLE_LABEL[ride.vehicle_type].toLowerCase()}</dd>
            <dt>Payment</dt>
            <dd className="text-right">{PAYMENT_LABEL[ride.payment_method]}</dd>
            <dt>To</dt>
            <dd className="truncate text-right">{dropoffName}</dd>
          </dl>
        </div>

        {ride.rider_rating == null ? (
          <div>
            <p className="mb-2 font-semibold">How was your trip with {firstName}?</p>
            <div className="flex justify-between gap-2" role="group" aria-label="Rate your driver">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => onRate(n)}
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                  className="flex h-12 flex-1 items-center justify-center rounded-xl bg-white/70 text-2xl hover:bg-ink hover:text-vest"
                >
                  ★
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="font-semibold">Thanks, you gave {ride.rider_rating} of 5 stars.</p>
        )}
        <Button onClick={onDone}>Book another ride</Button>
      </div>
    );
  }

  return (
    <div className="mashi-step flex flex-col gap-4" aria-live="polite">
      <h2 className="wide text-2xl font-extrabold">{heading}</h2>

      {ride.status === "requested" && (
        <>
          {!stale && <div className="mashi-searching h-1.5 rounded-full bg-white/60" aria-hidden="true" />}
          <p className="text-ink-soft">
            {stale
              ? "Cancel and request again, or try a different ride type."
              : `Nearby ${VEHICLE_LABEL[ride.vehicle_type].toLowerCase()} drivers can see your request now.`}
          </p>
        </>
      )}

      {stepIndex >= 0 && (
        <ol className="grid grid-cols-4 gap-1.5" aria-label="Trip progress">
          {STEPS.map((s, i) => (
            <li key={s.status}>
              <div className={`h-1.5 rounded-full ${i <= stepIndex ? "bg-ink" : "bg-white/60"}`} />
              <span className={`mt-1 block text-xs ${i === stepIndex ? "font-bold" : "text-ink-soft"}`}>{s.label}</span>
            </li>
          ))}
        </ol>
      )}

      {hasDriver && driver && (
        <div className="rounded-2xl bg-white/80 p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-vest text-2xl" aria-hidden="true">
              {VEHICLE_ICON[driver.vehicle_type]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">
                {name}
                {driver.rating_avg != null && (
                  <span className="ml-2 text-sm font-semibold text-ink-soft">★ {driver.rating_avg.toFixed(1)}</span>
                )}
              </p>
              <p className="text-sm text-ink-soft">
                {VEHICLE_LABEL[driver.vehicle_type]}, {driver.trips_completed} trips
              </p>
            </div>
            <span className="wide rounded-lg bg-ink px-3 py-2 text-base font-black tracking-wide text-vest">
              {driver.plate_number}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {phone && (
              <a href={`tel:${phone}`} className="flex h-11 items-center justify-center rounded-xl bg-ink font-bold text-white">
                Call
              </a>
            )}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
              target="_blank"
              rel="noreferrer"
              className={`flex h-11 items-center justify-center rounded-xl bg-white font-bold ring-2 ring-ink/80 ${phone ? "" : "col-span-2"}`}
            >
              Share trip
            </a>
          </div>
        </div>
      )}

      <div className="flex items-baseline justify-between rounded-2xl bg-white/70 px-4 py-3">
        <span className="font-semibold">{PAYMENT_LABEL[ride.payment_method]} fare</span>
        <span className="wide text-xl font-black">{formatSSP(ride.fare_ssp)}</span>
      </div>

      {canCancel && (
        <Button variant="danger" disabled={busy} onClick={onCancel}>
          Cancel ride
        </Button>
      )}
    </div>
  );
}
