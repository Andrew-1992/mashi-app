"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <section className="absolute inset-x-0 bottom-0 z-[500] mx-auto max-w-lg">
      <div className="vest max-h-[70vh] overflow-y-auto rounded-t-[28px] bg-vest px-5 pt-9 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-ink shadow-[0_-10px_30px_rgba(27,42,65,0.28)]">
        {children}
      </div>
    </section>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "quiet" | "danger";
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const styles = {
    primary: "bg-ink text-white hover:bg-ink-soft",
    quiet: "bg-white/70 text-ink ring-2 ring-ink/80 hover:bg-white",
    danger: "bg-transparent text-murram underline underline-offset-4 h-auto py-2",
  }[variant];
  return (
    <button
      {...props}
      className={`flex h-14 w-full items-center justify-center rounded-2xl px-5 text-base font-bold disabled:opacity-50 ${styles} ${className}`}
    />
  );
}

export function TopBar({ title }: { title?: string }) {
  const router = useRouter();
  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };
  return (
    <header className="absolute inset-x-0 top-0 z-[500] flex items-center justify-between gap-3 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <Link href="/" className="wide rounded-full bg-vest px-4 py-2 text-lg font-black text-ink shadow-md">
        Mashi
      </Link>
      <div className="flex items-center gap-2">
        {title && (
          <span className="rounded-full bg-white px-3 py-2 text-sm font-semibold shadow-md">{title}</span>
        )}
        <button onClick={signOut} className="rounded-full bg-white px-3 py-2 text-sm font-semibold shadow-md">
          Sign out
        </button>
      </div>
    </header>
  );
}

export function ErrorNote({ message, onClose }: { message: string | null; onClose: () => void }) {
  if (!message) return null;
  return (
    <div role="alert" className="mb-4 flex items-start justify-between gap-3 rounded-xl bg-white px-4 py-3 text-sm font-medium text-murram">
      <span>{message}</span>
      <button onClick={onClose} className="font-bold text-ink" aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}

export function Choice({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`flex-1 rounded-2xl px-3 py-3 text-left transition-colors ${
        selected ? "bg-ink text-white" : "bg-white/70 text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export function FullScreenMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-full items-center justify-center p-6 text-center">
      <div className="max-w-sm">{children}</div>
    </main>
  );
}
