"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import {
  ACTIVE_STATUSES,
  PAYMENT_LABEL,
  STATUS_LABEL,
  VEHICLE_LABEL,
  formatSSP,
  type Driver,
  type DriverStatus,
  type FareSetting,
  type Ride,
} from "@/lib/types";
import { FullScreenMessage } from "@/components/ui";

type DriverRow = Driver & { profiles: { full_name: string; phone: string } | null };
type Balance = { driver_id: string; commission_total: number; paid_total: number; owed: number };
type Tab = "drivers" | "rides" | "fares";

export default function AdminPage() {
  const router = useRouter();
  const { loading, userId, profile } = useProfile();
  const [tab, setTab] = useState<Tab>("drivers");
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [fares, setFares] = useState<FareSetting[]>([]);
  const [balances, setBalances] = useState<Record<string, Balance>>({});
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !userId) router.replace("/login?next=/admin");
  }, [loading, userId, router]);

  const isAdmin = profile?.role === "admin";

  const load = useCallback(async () => {
    const [d, r, f, b] = await Promise.all([
      supabase.from("drivers").select("*, profiles(full_name, phone)").order("created_at", { ascending: false }),
      supabase.from("rides").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("fare_settings").select("*").order("base_fare"),
      supabase.rpc("admin_driver_balances"),
    ]);
    const map: Record<string, Balance> = {};
    for (const row of (b.data ?? []) as Balance[]) map[row.driver_id] = { ...row, owed: Number(row.owed), commission_total: Number(row.commission_total), paid_total: Number(row.paid_total) };
    setBalances(map);
    setDrivers((d.data ?? []) as unknown as DriverRow[]);
    setRides((r.data ?? []) as Ride[]);
    setFares((f.data ?? []) as FareSetting[]);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [isAdmin, load]);

  const setDriverStatus = async (id: string, status: DriverStatus) => {
    const change: Partial<Driver> = { status };
    if (status !== "verified") change.is_online = false;
    const { error } = await supabase.from("drivers").update(change).eq("id", id);
    setMessage(error ? error.message : status === "verified" ? "Driver approved." : "Driver suspended.");
    load();
  };

  const recordPayment = async (driverId: string, amount: number, note: string) => {
    const { error } = await supabase.rpc("record_driver_payment", { p_driver: driverId, p_amount: amount, p_note: note });
    setMessage(error ? error.message : `Payment of ${formatSSP(amount)} recorded.`);
    load();
    return !error;
  };

  const saveFare = async (f: FareSetting) => {
    const { error } = await supabase
      .from("fare_settings")
      .update({
        base_fare: f.base_fare,
        per_km: f.per_km,
        minimum_fare: f.minimum_fare,
        commission_percent: f.commission_percent,
        active: f.active,
      })
      .eq("vehicle_type", f.vehicle_type);
    setMessage(error ? error.message : `${VEHICLE_LABEL[f.vehicle_type]} prices saved.`);
    load();
  };

  if (loading || !userId) {
    return (
      <FullScreenMessage>
        <p className="wide text-3xl font-black">Mashi</p>
      </FullScreenMessage>
    );
  }

  if (!isAdmin) {
    return (
      <FullScreenMessage>
        <h1 className="wide text-2xl font-extrabold">This page is for Mashi staff</h1>
        <p className="mt-2 text-ink-soft">Sign in with an admin account to manage drivers and prices.</p>
        <Link href="/rider" className="mt-6 inline-block font-bold underline underline-offset-4">
          Go to booking
        </Link>
      </FullScreenMessage>
    );
  }

  const today = new Date().toDateString();
  const ridesToday = rides.filter((r) => new Date(r.created_at).toDateString() === today);
  const completedToday = ridesToday.filter((r) => r.status === "completed");
  const stats = [
    { label: "Rides today", value: ridesToday.length },
    { label: "Active now", value: rides.filter((r) => ACTIVE_STATUSES.includes(r.status)).length },
    { label: "Drivers online", value: drivers.filter((d) => d.is_online).length },
    { label: "Fares today", value: formatSSP(completedToday.reduce((s, r) => s + r.fare_ssp, 0)) },
    { label: "Mashi commission today", value: formatSSP(completedToday.reduce((s, r) => s + r.commission_ssp, 0)) },
    { label: "Owed by drivers", value: formatSSP(Object.values(balances).reduce((s, b) => s + Math.max(0, b.owed), 0)) },
  ];
  const pending = drivers.filter((d) => d.status === "pending");

  return (
    <main className="min-h-full">
      <header className="bg-ink px-5 pt-8 pb-6 text-white sm:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center justify-between">
            <p className="wide text-3xl font-black text-vest">Mashi admin</p>
            <button
              className="rounded-full bg-white/10 px-3 py-2 text-sm font-semibold"
              onClick={async () => {
                await supabase.auth.signOut();
                router.replace("/login");
              }}
            >
              Sign out
            </button>
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="text-sm text-white/70">{s.label}</dt>
                <dd className="wide text-2xl font-extrabold">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <nav className="vest bg-vest px-5 pt-9 pb-3 sm:px-10" aria-label="Admin sections">
        <div className="mx-auto flex max-w-5xl gap-2">
          {(["drivers", "rides", "fares"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              aria-current={tab === t ? "page" : undefined}
              className={`rounded-full px-4 py-2 font-bold ${tab === t ? "bg-ink text-white" : "bg-white/70"}`}
            >
              {t === "drivers" ? `Drivers${pending.length ? ` (${pending.length} waiting)` : ""}` : t === "rides" ? "Rides" : "Prices"}
            </button>
          ))}
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-5 py-6 sm:px-10">
        {message && (
          <p role="status" className="mb-4 rounded-xl bg-white px-4 py-3 font-medium">
            {message}
          </p>
        )}

        {tab === "drivers" && (
          <ul className="divide-y divide-ink/10 rounded-2xl bg-white">
            {drivers.length === 0 && <li className="p-5 text-ink-soft">No drivers yet. Share the sign-up link with your first riders.</li>}
            {[...pending, ...drivers.filter((d) => d.status !== "pending")].map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-bold">{d.profiles?.full_name || "Unnamed driver"}</p>
                  <p className="text-sm text-ink-soft">
                    {VEHICLE_LABEL[d.vehicle_type]}, plate {d.plate_number}, {d.profiles?.phone || "no phone"}
                  </p>
                  <p className="text-sm">
                    {d.status === "pending" ? "Waiting for checks" : d.status === "verified" ? (d.is_online ? "Verified, online" : "Verified, offline") : "Suspended"}
                    {`, ${d.trips_completed} trips`}
                    {d.rating_avg != null ? `, ★ ${d.rating_avg.toFixed(1)}` : ""}
                  </p>
                  {balances[d.id] && (
                    <p className={`text-sm font-semibold ${balances[d.id].owed > 0 ? "text-murram" : "text-nile"}`}>
                      {balances[d.id].owed > 0 ? `Owes Mashi ${formatSSP(balances[d.id].owed)}` : "Commission fully paid"}
                      <span className="font-normal text-ink-soft">
                        {` (earned for Mashi ${formatSSP(balances[d.id].commission_total)}, paid ${formatSSP(balances[d.id].paid_total)})`}
                      </span>
                    </p>
                  )}
                  {balances[d.id]?.owed > 0 && <PaymentForm driverId={d.id} owed={balances[d.id].owed} onRecord={recordPayment} />}
                </div>
                <div className="flex gap-2">
                  {d.status !== "verified" && (
                    <button className="rounded-xl bg-nile px-4 py-2 font-bold text-white" onClick={() => setDriverStatus(d.id, "verified")}>
                      Approve
                    </button>
                  )}
                  {d.status !== "suspended" && (
                    <button className="rounded-xl px-4 py-2 font-bold text-murram ring-2 ring-murram" onClick={() => setDriverStatus(d.id, "suspended")}>
                      Suspend
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {tab === "rides" && (
          <div className="overflow-x-auto rounded-2xl bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-ink/10 text-ink-soft">
                <tr>
                  <th className="p-3 font-semibold">Time</th>
                  <th className="p-3 font-semibold">Type</th>
                  <th className="p-3 font-semibold">Pickup</th>
                  <th className="p-3 font-semibold">Distance</th>
                  <th className="p-3 font-semibold">Fare</th>
                  <th className="p-3 font-semibold">Commission</th>
                  <th className="p-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {rides.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-5 text-ink-soft">
                      No rides yet.
                    </td>
                  </tr>
                )}
                {rides.map((r) => (
                  <tr key={r.id}>
                    <td className="p-3 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="p-3">{VEHICLE_LABEL[r.vehicle_type]}</td>
                    <td className="p-3">{r.pickup_note || "Map pin"}</td>
                    <td className="p-3">{r.distance_km.toFixed(1)} km</td>
                    <td className="p-3 whitespace-nowrap">
                      {formatSSP(r.fare_ssp)} <span className="text-ink-soft">({PAYMENT_LABEL[r.payment_method]})</span>
                    </td>
                    <td className="p-3 whitespace-nowrap">{formatSSP(r.commission_ssp)}</td>
                    <td className="p-3">{STATUS_LABEL[r.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "fares" && (
          <div className="flex flex-col gap-4">
            <p className="text-ink-soft">
              Price = base fare + price per km × distance, rounded to the nearest 100 SSP, never below the minimum. Mashi&apos;s commission is a
              percentage of each fare; the driver keeps the rest. Changes apply to the next ride booked.
            </p>
            {fares.map((f) => (
              <FareEditor key={f.vehicle_type} fare={f} onSave={saveFare} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function FareEditor({ fare, onSave }: { fare: FareSetting; onSave: (f: FareSetting) => void }) {
  const [draft, setDraft] = useState(fare);
  useEffect(() => setDraft(fare), [fare]);

  const num = (key: "base_fare" | "per_km" | "minimum_fare" | "commission_percent", label: string) => (
    <label className="text-sm font-semibold">
      {label}
      <input
        type="number"
        min={0}
        step={key === "commission_percent" ? 1 : 100}
        max={key === "commission_percent" ? 50 : undefined}
        inputMode="numeric"
        className="mt-1 w-full rounded-xl bg-road px-3 py-2 text-base"
        value={draft[key]}
        onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
      />
    </label>
  );

  return (
    <div className="rounded-2xl bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="wide text-xl font-extrabold">{VEHICLE_LABEL[fare.vehicle_type]}</h2>
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" className="size-5 accent-[#1B2A41]" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
          Available to riders
        </label>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
        {num("base_fare", "Base fare (SSP)")}
        {num("per_km", "Per km (SSP)")}
        {num("minimum_fare", "Minimum fare (SSP)")}
        {num("commission_percent", "Mashi commission (%)")}
      </div>
      <button className="mt-4 rounded-xl bg-ink px-5 py-3 font-bold text-white" onClick={() => onSave(draft)}>
        Save prices
      </button>
    </div>
  );
}

function PaymentForm({
  driverId,
  owed,
  onRecord,
}: {
  driverId: string;
  owed: number;
  onRecord: (driverId: string, amount: number, note: string) => Promise<boolean>;
}) {
  const [amount, setAmount] = useState(String(owed));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="mt-2 flex flex-wrap items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const ok = await onRecord(driverId, Number(amount), note);
        setBusy(false);
        if (ok) setNote("");
      }}
    >
      <label className="sr-only" htmlFor={`amt-${driverId}`}>Amount paid (SSP)</label>
      <input
        id={`amt-${driverId}`}
        type="number"
        min={1}
        inputMode="numeric"
        className="w-32 rounded-xl bg-road px-3 py-2"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <label className="sr-only" htmlFor={`note-${driverId}`}>Note</label>
      <input
        id={`note-${driverId}`}
        className="w-44 rounded-xl bg-road px-3 py-2"
        placeholder="e.g. MoMo ref 12345"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button disabled={busy} className="rounded-xl bg-ink px-4 py-2 font-bold text-white disabled:opacity-50">
        Record payment
      </button>
    </form>
  );
}
