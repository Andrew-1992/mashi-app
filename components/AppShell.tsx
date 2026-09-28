"use client";

import { useEffect, useState } from "react";

/** App-wide: registers the service worker and shows a bar when the phone loses connection. */
export default function AppShell() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  if (online) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[900] bg-murram px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 text-center text-sm font-semibold text-white"
    >
      You&apos;re offline. Mashi will reconnect when your network is back.
    </div>
  );
}
