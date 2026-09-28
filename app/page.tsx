import Link from "next/link";
import RoadScene from "@/components/RoadScene";

export default function Home() {
  return (
    <main className="flex min-h-full flex-col">
      <section className="px-6 pt-14 pb-8 sm:px-12 sm:pt-20">
        <div className="mx-auto w-full max-w-3xl">
          <h1 className="wide text-[clamp(4.5rem,20vw,11rem)] leading-[0.85] font-black text-ink">Mashi</h1>
          <p className="wide mt-5 text-2xl font-bold sm:text-3xl">Wasulu mahal taki</p>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-ink-soft">
            Boda, tuk-tuk and car rides across Juba. See your price before you book, and pay in cash or mobile money.
          </p>
        </div>
      </section>

      <RoadScene />

      <section className="flex-1 bg-vest px-6 pt-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-12">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 sm:flex-row">
          <Link
            href="/rider"
            className="group inline-flex h-14 flex-1 items-center justify-center gap-3 rounded-full bg-ink px-8 text-lg font-bold text-white shadow-[0_10px_24px_-8px_rgba(27,42,65,0.55)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-8px_rgba(27,42,65,0.6)] active:translate-y-0 active:scale-[0.98]"
          >
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
              <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" fill="#FFC20E" />
            </svg>
            Book a ride
          </Link>
          <Link
            href="/driver"
            className="inline-flex h-14 flex-1 items-center justify-center gap-3 rounded-full bg-white px-8 text-lg font-bold text-ink shadow-[0_6px_16px_-8px_rgba(27,42,65,0.35)] ring-1 ring-ink/10 transition duration-200 hover:-translate-y-0.5 hover:ring-ink/25 active:translate-y-0 active:scale-[0.98]"
          >
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" fill="none" stroke="#1B2A41" strokeWidth="2.2">
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="2.5" />
              <path d="M3.5 10.5h6M14.5 10.5h6M12 14.5V21" strokeLinecap="round" />
            </svg>
            Drive with Mashi
          </Link>
        </div>
        <div className="mx-auto mt-6 flex w-full max-w-3xl flex-col gap-2 text-sm text-ink-soft sm:flex-row sm:justify-between">
          <p>Every Mashi driver is registered and verified before their first trip.</p>
          <Link href="/login" className="font-bold text-ink underline underline-offset-4">
            Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
