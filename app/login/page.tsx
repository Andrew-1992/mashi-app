"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button, ErrorNote } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [wantsToDrive, setWantsToDrive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const goHome = async (userId: string) => {
    const next = new URLSearchParams(window.location.search).get("next");
    if (next && next.startsWith("/")) return router.replace(next);
    if (wantsToDrive) return router.replace("/driver");
    const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
    const role = (data as { role?: string } | null)?.role;
    router.replace(role === "admin" ? "/admin" : role === "driver" ? "/driver" : "/rider");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    if (mode === "signup") {
      if (!fullName.trim() || !phone.trim()) {
        setBusy(false);
        return setError("Enter your name and phone number so drivers and riders can reach you.");
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName.trim(), phone: phone.trim() } },
      });
      setBusy(false);
      if (error) return setError(error.message);
      if (!data.session) return setNotice("Check your email to confirm your account, then sign in.");
      return goHome(data.session.user.id);
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setError(error.message);
    goHome(data.user.id);
  };

  const field = "h-13 w-full rounded-xl bg-white px-4 py-3 text-base text-ink placeholder:text-ink-soft/60";

  return (
    <main className="flex min-h-full flex-col">
      <div className="px-6 pt-10 pb-6">
        <Link href="/" className="wide text-5xl font-black">
          Mashi
        </Link>
        <p className="mt-2 text-ink-soft">
          {mode === "signin" ? "Sign in to book or drive." : "Create your Mashi account."}
        </p>
      </div>

      <form onSubmit={submit} className="vest flex flex-1 flex-col gap-3 bg-vest px-6 pt-12 pb-10">
        <div className="mx-auto flex w-full max-w-md flex-col gap-3">
          <ErrorNote message={error} onClose={() => setError(null)} />
          {notice && <p className="rounded-xl bg-white px-4 py-3 text-sm font-medium">{notice}</p>}

          {mode === "signup" && (
            <>
              <label className="text-sm font-semibold">
                Full name
                <input className={`${field} mt-1`} value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required />
              </label>
              <label className="text-sm font-semibold">
                Phone number
                <input className={`${field} mt-1`} value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="+211 9…" autoComplete="tel" required />
              </label>
            </>
          )}
          <label className="text-sm font-semibold">
            Email
            <input className={`${field} mt-1`} value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required />
          </label>
          <label className="text-sm font-semibold">
            Password
            <input
              className={`${field} mt-1`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
            />
          </label>

          {mode === "signup" && (
            <label className="flex items-center gap-3 py-2 text-base font-medium">
              <input type="checkbox" className="size-5 accent-[#1B2A41]" checked={wantsToDrive} onChange={(e) => setWantsToDrive(e.target.checked)} />
              I want to drive with Mashi
            </label>
          )}

          <Button type="submit" disabled={busy} className="mt-2">
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
          <Button
            type="button"
            variant="danger"
            className="text-ink"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setNotice(null);
            }}
          >
            {mode === "signin" ? "New to Mashi? Create an account" : "Already have an account? Sign in"}
          </Button>
        </div>
      </form>
    </main>
  );
}
