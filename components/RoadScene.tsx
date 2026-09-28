import Link from "next/link";

/* Original illustrations of Mashi's three ride types, drawn facing right. */

function Wheel({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#1B2A41" />
      <g className="mashi-wheel">
        <circle cx={cx} cy={cy} r={r * 0.55} fill="#D5DAE1" />
        <line x1={cx - r * 0.5} y1={cy} x2={cx + r * 0.5} y2={cy} stroke="#1B2A41" strokeWidth="2" />
        <line x1={cx} y1={cy - r * 0.5} x2={cx} y2={cy + r * 0.5} stroke="#1B2A41" strokeWidth="2" />
      </g>
      <circle cx={cx} cy={cy} r={r * 0.15} fill="#1B2A41" />
    </g>
  );
}

function Boda() {
  return (
    <svg viewBox="0 0 120 84" className="h-auto w-full" aria-hidden="true">
      <g className="mashi-bob">
        {/* rider */}
        <path d="M49 40 L66 44 L72 60" fill="none" stroke="#1B2A41" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M44 40 L51 15 Q56 11 62 15 L60 41 Z" fill="#0E7C7B" />
        <path d="M57 21 L80 29" stroke="#0E7C7B" strokeWidth="5" strokeLinecap="round" />
        <circle cx="57" cy="9" r="8" fill="#FFC20E" stroke="#1B2A41" strokeWidth="2" />
        <path d="M60 6 L66 8 L65 12 L59 11 Z" fill="#1B2A41" />
        {/* bike */}
        <path d="M22 66 L42 48 L76 48 L98 66" fill="none" stroke="#1B2A41" strokeWidth="5" strokeLinejoin="round" />
        <path d="M40 44 Q58 33 80 41 L76 51 L44 51 Z" fill="#FFC20E" stroke="#1B2A41" strokeWidth="2" />
        <rect x="32" y="39" width="26" height="6" rx="3" fill="#1B2A41" />
        <line x1="84" y1="30" x2="98" y2="66" stroke="#1B2A41" strokeWidth="4" strokeLinecap="round" />
        <line x1="78" y1="28" x2="88" y2="30" stroke="#1B2A41" strokeWidth="4" strokeLinecap="round" />
        <circle cx="90" cy="39" r="3.5" fill="#FFF3B0" stroke="#1B2A41" strokeWidth="1.5" />
      </g>
      <Wheel cx={22} cy={66} r={15} />
      <Wheel cx={98} cy={66} r={15} />
    </svg>
  );
}

function TukTuk() {
  return (
    <svg viewBox="0 0 140 92" className="h-auto w-full" aria-hidden="true">
      <g className="mashi-bob">
        <path
          d="M16 72 L16 34 Q18 12 42 12 L100 12 Q112 12 117 24 L128 54 Q130 66 122 72 Z"
          fill="#FFC20E"
          stroke="#1B2A41"
          strokeWidth="2.5"
        />
        <path d="M18 26 Q22 12 42 12 L100 12 Q111 12 116 24 Z" fill="#1B2A41" />
        <rect x="28" y="30" width="36" height="24" rx="5" fill="#CFE3F0" stroke="#1B2A41" strokeWidth="2" />
        <path d="M74 30 L106 30 L117 54 L74 54 Z" fill="#CFE3F0" stroke="#1B2A41" strokeWidth="2" />
        <circle cx="90" cy="39" r="5" fill="#1B2A41" />
        <path d="M84 54 Q90 44 96 54 Z" fill="#1B2A41" />
        <rect x="16" y="60" width="112" height="5" fill="#1B2A41" opacity="0.18" />
        <circle cx="124" cy="60" r="3.5" fill="#FFF3B0" stroke="#1B2A41" strokeWidth="1.5" />
      </g>
      <Wheel cx={36} cy={74} r={13} />
      <Wheel cx={110} cy={74} r={13} />
    </svg>
  );
}

function Car() {
  return (
    <svg viewBox="0 0 172 82" className="h-auto w-full" aria-hidden="true">
      <g className="mashi-bob">
        <path
          d="M8 62 L8 44 Q10 35 24 33 L52 30 L68 15 Q72 11 80 11 L120 11 Q128 11 134 17 L148 30 L162 34 Q168 36 168 45 L168 62 Z"
          fill="#F7F8FA"
          stroke="#1B2A41"
          strokeWidth="2.5"
        />
        <path d="M60 30 L73 17 L98 17 L98 30 Z" fill="#B9D3E3" stroke="#1B2A41" strokeWidth="2" />
        <path d="M104 17 L120 17 Q126 17 130 21 L140 30 L104 30 Z" fill="#B9D3E3" stroke="#1B2A41" strokeWidth="2" />
        <rect x="8" y="43" width="160" height="6" fill="#FFC20E" />
        <rect x="160" y="37" width="7" height="5" rx="1" fill="#FFD66B" />
        <rect x="9" y="37" width="6" height="5" rx="1" fill="#D9534F" />
      </g>
      <Wheel cx={42} cy={64} r={14} />
      <Wheel cx={136} cy={64} r={14} />
    </svg>
  );
}

const VEHICLES = [
  { key: "boda", label: "Book a boda", art: <Boda />, width: "w-[96px] sm:w-[112px]", lane: "near", dur: "7s", delay: "-2s", rest: "8%" },
  { key: "car", label: "Book a car", art: <Car />, width: "w-[128px] sm:w-[156px]", lane: "far", dur: "11s", delay: "-1.5s", rest: "38%" },
  { key: "tuktuk", label: "Book a tuk-tuk", art: <TukTuk />, width: "w-[110px] sm:w-[126px]", lane: "far", dur: "11s", delay: "-7s", rest: "70%" },
];

export default function RoadScene() {
  return (
    <section aria-label="Mashi rides" className="relative">
      <p className="mx-auto mb-2 max-w-3xl px-6 text-right text-sm font-semibold text-ink-soft sm:px-12">
        Tap a ride to book
      </p>
      <div className="mashi-road relative h-[190px] overflow-hidden sm:h-[210px]">
        {VEHICLES.map((v) => (
          <Link
            key={v.key}
            href="/rider"
            aria-label={v.label}
            className={`mashi-drive group absolute ${v.width} ${v.lane === "near" ? "bottom-[14px] z-20" : "bottom-[96px] z-10 sm:bottom-[108px]"}`}
            style={{ "--dur": v.dur, "--delay": v.delay, "--rest": v.rest } as React.CSSProperties}
          >
            <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 rounded-full bg-white px-3 py-1 text-sm font-bold whitespace-nowrap text-ink opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              {v.label}
            </span>
            <span className="block transition-transform duration-200 group-hover:-translate-y-1.5 group-active:scale-95">{v.art}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
