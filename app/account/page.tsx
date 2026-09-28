"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import { STATUS_LABEL, VEHICLE_LABEL, formatSSP, type Ride } from "@/lib/types";
import { Button, FullScreenMessage } from "@/components/ui";
import { VEHICLE_ICON } from "@/components/rider/RideOptions";

export default function AccountPage() {
  const router = useRouter();
  const { loading, userId, profile } = useProfile();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [eName, setEName] = useState("");
  const [ePhone, setEPhone] = useState("");
  const [trips, setTrips] = useState<Ride[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !userId) router.replace("/login?next=/account");
  }, [loading, userId, router]);

  useEffect(() => {
    if (!profile) return;
    setName(profile.full_name);
    setPhone(profile.phone);
    setEName(profile.emergency_name ?? "");
    setEPhone(profile.emergency_phone ?? "");
  }, [profile]);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("rides")
      .select("*")
      .or(`rider_id.eq.${userId},driver_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => setTrips((data ?? []) as Ride[]));
  }, [userId]);

  if (loading || !userId) {
    return (
      <FullScreenMessage>
        <p className="wide text-3xl font-black">Mashi</p>
      </FullScreenMessage>
    );
  }

  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    setMessage(error ? error.message : ok);
  };

  const field = "mt-1 w-full rounded-xl bg-white px-4 py-3 text-base";
  const backHref = profile?.role === "driver" ? "/driver" : profile?.role === "admin" ? "/admin" : "/rider";

  return (
    <main className="min-h-dvh pb-10">
      <header className="bg-vest px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-6">
        <div className="mx-auto max-w-lg">
          <Link href={backHref} className="inline-block rounded-full bg-white/70 px-3 py-2 font-bold" aria-label="Back">
            ←
          </Link>
          <div className="mt-4 flex items-center gap-4">
            <span className="wide flex size-16 items-center justify-center rounded-full bg-ink text-2xl font-black text-vest" aria-hidden="true">
              {(profile?.full_name || "?").charAt(0).toUpperCase()}
            </span>
            <div>
              <h1 className="wide text-2xl font-extrabold">{profile?.full_name || "Your account"}</h1>
              <p className="text-ink-soft">{profile?.phone}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-lg flex-col gap-6 px-5 pt-6">
        {message && (
          <p role="status" className="rounded-xl bg-white px-4 py-3 font-medium">
            {message}
          </p>
        )}

        <section id="emergency" className="rounded-3xl bg-white/70 p-5">
          <h2 className="wide text-lg font-extrabold">🛡️ Emergency contact</h2>
          <p className="mt-1 text-sm text-ink-soft">One tap from the Safety button during any trip.</p>
          <label className="mt-3 block text-sm font-semibold">
            Name
            <input className={field} value={eName} onChange={(e) => setEName(e.target.value)} placeholder="e.g. Mama" />
          </label>
          <label className="mt-3 block text-sm font-semibold">
            Phone
            <input className={field} value={ePhone} onChange={(e) => setEPhone(e.target.value)} type="tel" placeholder="+211 9…" />
          </label>
          <Button className="mt-4" disabled={busy} onClick={() => run(() => supabase.rpc("set_emergency_contact", { p_name: eName, p_phone: ePhone }), "Emergency contact saved.")}>
            Save emergency contact
          </Button>
        </section>

        <section className="rounded-3xl bg-white/70 p-5">
          <h2 className="wide text-lg font-extrabold">👤 Your details</h2>
          <label className="mt-3 block text-sm font-semibold">
            Full name
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
          <label className="mt-3 block text-sm font-semibold">
            Phone
            <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" autoComplete="tel" />
          </label>
          <Button variant="quiet" className="mt-4" disabled={busy} onClick={() => run(() => supabase.rpc("update_my_profile", { p_full_name: name, p_phone: phone }), "Details saved.")}>
            Save details
          </Button>
        </section>

        <section>
          <h2 className="wide mb-3 text-lg font-extrabold">🕘 My trips</h2>
          {trips.length === 0 ? (
            <p className="rounded-3xl bg-white/70 p-5 text-ink-soft">No trips yet. Your rides will show here.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {trips.map((t) => (
                <li key={t.id} className="flex items-center gap-3 rounded-2xl bg-white/70 p-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-vest text-xl" aria-hidden="true">
                    {VEHICLE_ICON[t.vehicle_type]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{t.dropoff_note || `${VEHICLE_LABEL[t.vehicle_type]} trip`}</p>
                    <p className="text-sm text-ink-soft">
                      {new Date(t.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, {STATUS_LABEL[t.status]}
                      {t.rider_rating ? `, ${"★".repeat(t.rider_rating)}` : ""}
                      {t.driver_id === userId ? ", you drove" : ""}
                    </p>
                  </div>
                  <span className="font-bold whitespace-nowrap">{formatSSP(t.fare_ssp)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Button
          variant="danger"
          onClick={async () => {
            await supabase.auth.signOut();
            router.replace("/login");
          }}
        >
          Sign out
        </Button>
      </div>
    </main>
  );
}
