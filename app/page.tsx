import Link from "next/link";
import RoadScene from "@/components/RoadScene";
import InstallButton from "@/components/InstallButton";

const wrap = "mx-auto w-full max-w-5xl px-6 sm:px-10";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col">
      {/* Top bar */}
      <header className={`${wrap} flex items-center justify-between pt-[max(1rem,env(safe-area-inset-top))] pb-2`}>
        <Link
          href="/"
          aria-label="Mashi home"
          className="wide rounded-[50%] bg-vest px-6 py-2.5 text-lg leading-none font-black text-ink shadow-[0_6px_16px_-6px_rgba(27,42,65,0.45)]"
        >
          Mashi
        </Link>
        <div className="flex items-center gap-2">
          <InstallButton />
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-bold text-ink ring-1 ring-ink/15 transition hover:bg-white hover:ring-ink/30"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className={`${wrap} mashi-hero flex flex-1 flex-col items-center justify-center pt-2 pb-4`}>
        <h1 className="sr-only">Mashi. Wasulu mahal taki</h1>
        <img
          src="/hero.jpg"
          width={800}
          height={993}
          fetchPriority="high"
          alt="A young woman on a street in Juba laughing and raising her fist as she shows a Mashi ride booked on her phone"
          className="h-[clamp(220px,40vh,460px)] w-auto rounded-[28px] object-cover shadow-[0_18px_40px_-18px_rgba(27,42,65,0.55)]"
        />
      </section>

      <RoadScene />

      {/* Actions */}
      <section className="bg-vest pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className={`${wrap} grid grid-cols-2 gap-3 sm:flex sm:justify-center`}>
          <Link
            href="/rider"
            className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-ink px-4 text-base whitespace-nowrap sm:gap-3 sm:px-9 sm:text-lg font-bold text-white shadow-[0_10px_24px_-10px_rgba(27,42,65,0.7)] transition duration-200 hover:-translate-y-0.5 hover:bg-ink-soft active:translate-y-0 active:scale-[0.98] sm:min-w-60"
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
            className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-white/80 px-4 text-base whitespace-nowrap sm:gap-3 sm:px-9 sm:text-lg font-bold text-ink ring-1 ring-ink/10 transition duration-200 hover:-translate-y-0.5 hover:bg-white active:translate-y-0 active:scale-[0.98] sm:min-w-60"
          >
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" fill="none" stroke="#1B2A41" strokeWidth="2.2">
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="2.5" />
              <path d="M3.5 10.5h6M14.5 10.5h6M12 14.5V21" strokeLinecap="round" />
            </svg>
            <span className="sm:hidden">Drive &amp; earn</span>
            <span className="hidden sm:inline">Drive with Mashi</span>
          </Link>
        </div>
        <ul className={`${wrap} mt-5 flex justify-center gap-2 text-sm font-semibold`} aria-label="Why Mashi">
          <li className="flex items-center gap-1.5 rounded-full bg-white/60 px-3 py-1.5">
            <span aria-hidden="true">✅</span> Verified drivers
          </li>
          <li className="flex items-center gap-1.5 rounded-full bg-white/60 px-3 py-1.5">
            <span aria-hidden="true">💵</span> Cash
          </li>
          <li className="flex items-center gap-1.5 rounded-full bg-white/60 px-3 py-1.5">
            <span aria-hidden="true">📱</span> Mobile money
          </li>
        </ul>
      </section>
    </main>
  );
}
