"use client";

import { estimateFare } from "@/lib/geo";
import { etaMinutes, type Place } from "@/lib/places";
import { PAYMENT_LABEL, VEHICLE_LABEL, formatSSP, type FareSetting, type PaymentMethod, type VehicleType } from "@/lib/types";
import { Button, Choice } from "@/components/ui";

export const VEHICLE_ICON: Record<VehicleType, string> = { boda: "🏍️", tuktuk: "🛺", car: "🚗" };
const VEHICLE_BLURB: Record<VehicleType, string> = {
  boda: "Fastest through traffic, 1 rider",
  tuktuk: "Covered, up to 3 riders",
  car: "Comfort and space, up to 4 riders",
};

export type Nearby = Partial<Record<VehicleType, { drivers: number; nearest_km: number }>>;

type Props = {
  pickup: Place;
  dropoff: Place;
  km: number;
  fares: FareSetting[];
  nearby: Nearby;
  vehicle: VehicleType;
  payment: PaymentMethod;
  note: string;
  busy: boolean;
  onVehicle: (v: VehicleType) => void;
  onPayment: (p: PaymentMethod) => void;
  onNote: (n: string) => void;
  onEdit: () => void;
  onConfirm: () => void;
};

export default function RideOptions(props: Props) {
  const { pickup, dropoff, km, fares, nearby, vehicle, payment, note, busy } = props;
  const selected = fares.find((f) => f.vehicle_type === vehicle);

  return (
    <div className="mashi-step flex flex-col gap-4">
      <button onClick={props.onEdit} className="flex items-center gap-3 rounded-2xl bg-white/70 px-4 py-3 text-left">
        <span className="flex flex-col items-center gap-1" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-nile" />
          <span className="h-4 w-0.5 bg-ink/40" />
          <span className="size-2.5 bg-ink" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{pickup.label}</span>
          <span className="block truncate font-semibold">{dropoff.label}</span>
        </span>
        <span className="text-sm font-semibold text-ink-soft">{km.toFixed(1)} km</span>
      </button>

      <div role="radiogroup" aria-label="Ride type" className="flex flex-col gap-2">
        {fares.map((f) => {
          const near = nearby[f.vehicle_type];
          const on = vehicle === f.vehicle_type;
          return (
            <button
              key={f.vehicle_type}
              role="radio"
              aria-checked={on}
              onClick={() => props.onVehicle(f.vehicle_type)}
              className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors ${
                on ? "bg-ink text-white" : "bg-white/70 text-ink"
              }`}
            >
              <span
                className={`flex size-12 shrink-0 items-center justify-center rounded-full text-2xl ${on ? "bg-vest" : "bg-road"}`}
                aria-hidden="true"
              >
                {VEHICLE_ICON[f.vehicle_type]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{VEHICLE_LABEL[f.vehicle_type]}</span>
                <span className={`block truncate text-sm ${on ? "text-white/75" : "text-ink-soft"}`}>
                  {near
                    ? `${etaMinutes(near.nearest_km)} min away, ${near.drivers} nearby`
                    : "No drivers nearby right now"}
                </span>
                <span className={`block truncate text-xs ${on ? "text-white/60" : "text-ink-soft/80"}`}>
                  {VEHICLE_BLURB[f.vehicle_type]}
                </span>
              </span>
              <span className="wide text-lg font-black whitespace-nowrap">{formatSSP(estimateFare(km, f))}</span>
            </button>
          );
        })}
      </div>

      <div role="radiogroup" aria-label="Payment" className="flex gap-2">
        {(["cash", "mobile_money"] as PaymentMethod[]).map((p) => (
          <Choice key={p} selected={payment === p} onClick={() => props.onPayment(p)}>
            <span className="block text-center font-semibold">
              {p === "cash" ? "💵 " : "📱 "}
              {PAYMENT_LABEL[p]}
            </span>
          </Choice>
        ))}
      </div>

      <input
        className="rounded-xl bg-white px-4 py-3"
        placeholder="Note for driver, e.g. blue gate opposite the church"
        value={note}
        onChange={(e) => props.onNote(e.target.value)}
        aria-label="Note for driver"
      />

      <Button disabled={busy || !selected} onClick={props.onConfirm}>
        {busy
          ? "Requesting…"
          : selected
            ? `Confirm ${VEHICLE_LABEL[vehicle]} for ${formatSSP(estimateFare(km, selected))}`
            : "Choose a ride"}
      </Button>
    </div>
  );
}
