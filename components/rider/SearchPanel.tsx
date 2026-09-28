"use client";

import { useEffect, useRef, useState } from "react";
import { searchPlaces, type Place, type SavedPlaces } from "@/lib/places";

export type Field = "pickup" | "dropoff";
export type MapTarget = "pickup" | "dropoff" | "home" | "work";

type Props = {
  field: Field;
  pickup: Place | null;
  dropoff: Place | null;
  saved: SavedPlaces;
  recents: Place[];
  onField: (f: Field) => void;
  onSelect: (place: Place, field: Field) => void;
  onUseMyLocation: () => void;
  onChooseOnMap: (target: MapTarget) => void;
  onClose: () => void;
};

export default function SearchPanel({
  field,
  pickup,
  dropoff,
  saved,
  recents,
  onField,
  onSelect,
  onUseMyLocation,
  onChooseOnMap,
  onClose,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQuery("");
    setResults([]);
    setProblem(null);
    inputRef.current?.focus();
  }, [field]);

  // Search as the rider types, waiting for a short pause to respect the free search service.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const ctrl = new AbortController();
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const found = await searchPlaces(q, ctrl.signal);
        setResults(found);
        setProblem(found.length ? null : `No places in Juba match "${q}". Try another name or choose on the map.`);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setProblem((e as Error).message);
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 450);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  const row = (key: string, icon: string, title: string, detail: string | undefined, onClick: () => void) => (
    <li key={key}>
      <button onClick={onClick} className="flex w-full items-center gap-4 px-5 py-3 text-left hover:bg-road">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-road text-lg" aria-hidden="true">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold">{title}</span>
          {detail && <span className="block truncate text-sm text-ink-soft">{detail}</span>}
        </span>
      </button>
    </li>
  );

  const pickSaved = (key: "home" | "work") => {
    const place = saved[key];
    if (place) onSelect(place, field);
    else onChooseOnMap(key);
  };

  const fieldBox = (f: Field, dot: string, placeholder: string, value: Place | null) =>
    field === f ? (
      <div className="flex items-center gap-3 rounded-xl bg-white px-3 ring-2 ring-ink">
        <span className={`size-3 shrink-0 ${dot}`} aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-12 w-full bg-transparent text-base outline-none"
          autoComplete="off"
          enterKeyHint="search"
        />
        {query && (
          <button onClick={() => setQuery("")} className="px-1 text-ink-soft" aria-label="Clear">
            ✕
          </button>
        )}
      </div>
    ) : (
      <button onClick={() => onField(f)} className="flex h-12 w-full items-center gap-3 rounded-xl bg-white/70 px-3 text-left">
        <span className={`size-3 shrink-0 ${dot}`} aria-hidden="true" />
        <span className={`truncate ${value ? "" : "text-ink-soft"}`}>{value?.label ?? placeholder}</span>
      </button>
    );

  return (
    <div className="fixed inset-0 z-[700] flex flex-col bg-white" role="dialog" aria-label="Choose your trip">
      <div className="bg-vest px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
        <div className="mx-auto max-w-lg">
          <div className="mb-3 flex items-center gap-3">
            <button onClick={onClose} className="rounded-full bg-white/70 px-3 py-2 font-bold" aria-label="Back">
              ←
            </button>
            <h1 className="wide text-xl font-extrabold">{field === "pickup" ? "Set pickup" : "Where to?"}</h1>
          </div>
          <div className="flex flex-col gap-2">
            {fieldBox("pickup", "rounded-full bg-nile", "Pickup location", pickup)}
            {fieldBox("dropoff", "bg-ink", "Where to?", dropoff)}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-lg">
          {searching && <div className="mashi-searching mx-5 mt-3 h-1 rounded-full bg-road" aria-label="Searching" />}
          {problem && <p className="px-5 pt-4 text-sm text-murram">{problem}</p>}

          <ul className="py-2">
            {query.trim().length >= 2 ? (
              results.map((p, i) => row(`r${i}`, "📍", p.label, p.detail, () => onSelect(p, field)))
            ) : (
              <>
                {field === "pickup" && row("me", "🎯", "Use my current location", undefined, onUseMyLocation)}
                {row("home", "🏠", "Home", saved.home?.label ?? "Set your home", () => pickSaved("home"))}
                {row("work", "💼", "Work", saved.work?.label ?? "Set your work place", () => pickSaved("work"))}
                {recents.map((p, i) => row(`h${i}`, "🕘", p.label, "Recent trip", () => onSelect(p, field)))}
              </>
            )}
            {row("map", "🗺️", "Choose on the map", "Move the map under the pin", () => onChooseOnMap(field))}
          </ul>
        </div>
      </div>
    </div>
  );
}
