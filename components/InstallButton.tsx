"use client";

import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void> };

/** "Install app" on Android and desktop Chrome; a short how-to on iPhone. Hidden once installed. */
export default function InstallButton() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(true);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    if (standalone) return;
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || (!event && !ios)) return null;

  const pill = "rounded-full bg-ink px-4 py-2 text-sm font-bold text-white transition hover:bg-ink-soft";

  if (event) {
    return (
      <button
        className={pill}
        onClick={async () => {
          await event.prompt();
          setEvent(null);
        }}
      >
        Install app
      </button>
    );
  }

  return (
    <div className="relative">
      <button className={pill} onClick={() => setShowHint((s) => !s)} aria-expanded={showHint}>
        Install app
      </button>
      {showHint && (
        <p role="status" className="absolute right-0 top-12 z-50 w-60 rounded-2xl bg-white p-4 text-sm shadow-lg">
          Tap the <strong>Share</strong> button in Safari, then <strong>Add to Home Screen</strong>.
        </p>
      )}
    </div>
  );
}
