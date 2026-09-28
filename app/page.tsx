import Link from "next/link";
import RoadScene from "@/components/RoadScene";

const wrap = "mx-auto w-full max-w-5xl px-6 sm:px-10";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col">
      {/* Top bar */}
      <header className={`${wrap} flex items-center justify-between pt-[max(1rem,env(safe-area-inset-top))] pb-2`}>
        <span className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
          <span className="size-2 rounded-full bg-nile" aria-hidden="true" />
          Now riding in Juba
        </span>
        <Link
          href="/login"
          className="rounded-full px-4 py-2 text-sm font-bold text-ink ring-1 ring-ink/15 transition hover:bg-white hover:ring-ink/30"
        >
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <section className={`${wrap} mashi-hero flex flex-1 flex-col justify-center py-6 sm:py-8`}>
        <h1 className="wide text-[clamp(4rem,14vw,8.5rem)] leading-[0.85] font-black text-ink">Mashi</h1>
        <p className="wide mt-4 text-[clamp(1.5rem,4vw,2.25rem)] leading-tight font-bold">Wasulu mahal taki</p>
        <p className="mt-3 max-w-md text-base leading-relaxed text-ink-soft sm:text-lg">
          Boda, tuk-tuk and car rides across Juba. See your price before you book, and pay in cash or mobile money.
        </p>
      </section>

      <RoadScene />

      {/* Actions */}
      <section className="bg-vest pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className={`${wrap} flex flex-col gap-3 sm:flex-row sm:items-center`}>
          <Link
            href="/rider"
            className="inline-flex h-14 items-center justify-center gap-3 rounded-full bg-ink px-9 text-lg font-bold text-white shadow-[0_10px_24px_-10px_rgba(27,42,65,0.7)] transition duration-200 hover:-translate-y-0.5 hover:bg-ink-soft active:translate-y-0 active:scale-[0.98] sm:min-w-60"
          >
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
              <path
                d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"
                fill="#FFC20E"
              />
            </svg>
            Book a ride
          </Link>
          <Link
            href="/driver"
            className="inline-flex h-14 items-center justify-center gap-3 rounded-full bg-white/80 px-9 text-lg font-bold text-ink ring-1 ring-ink/10 transition duration-200 hover:-translate-y-0.5 hover:bg-white active:translate-y-0 active:scale-[0.98] sm:min-w-60"
          >
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" fill="none" stroke="#1B2A41" strokeWidth="2.2">
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="2.5" />
              <path d="M3.5 10.5h6M14.5 10.5h6M12 14.5V21" strokeLinecap="round" />
            </svg>
            Drive with Mashi
          </Link>
          <p className="text-sm text-ink-soft sm:ml-auto sm:max-w-56 sm:text-right">
            Every driver is registered and verified before their first trip.
          </p>
        </div>
      </section>
    </main>
  );
}
