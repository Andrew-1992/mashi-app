"use client";

import Link from "next/link";
import { useState } from "react";
import { EMERGENCY_NUMBER, liveTripUrl, whatsappLink } from "@/lib/safety";
import type { Profile, Ride } from "@/lib/types";

type Props = {
  ride: Ride;
  profile?: Profile;
  driverName: string;
  plate?: string;
  onClose: () => void;
};

export default function SafetyPanel({ ride, profile, driverName, plate, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const link = liveTripUrl(ride.share_token);
  const message = `Follow my Mashi trip live: ${link}` + (plate ? ` (driver ${driverName}, plate ${plate})` : "");
  const contact = profile?.emergency_phone ? { name: profile.emergency_name || "your contact", phone: profile.emergency_phone } : null;

  const big = "flex h-14 w-full items-center gap-3 rounded-2xl px-5 text-left text-lg font-bold";

  return (
    <div className="fixed inset-0 z-[800] flex flex-col bg-road" role="dialog" aria-label="Safety">
      <div className="flex items-center gap-3 bg-ink px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 text-white">
        <button onClick={onClose} className="rounded-full bg-white/15 px-3 py-2 font-bold" aria-label="Back to trip">
          ←
        </button>
        <h2 className="wide text-xl font-extrabold">🛡️ Safety</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto flex max-w-lg flex-col gap-3">
          {EMERGENCY_NUMBER && (
            <a href={`tel:${EMERGENCY_NUMBER}`} className={`${big} bg-murram text-white`}>
              <span aria-hidden="true">🚨</span> Call emergency services
            </a>
          )}

          {contact ? (
            <>
              <a href={`tel:${contact.phone}`} className={`${big} bg-ink text-white`}>
                <span aria-hidden="true">📞</span> Call {contact.name}
              </a>
              <a href={whatsappLink(message, contact.phone)} target="_blank" rel="noreferrer" className={`${big} bg-white`}>
                <span aria-hidden="true">📍</span> Send live trip to {contact.name}
              </a>
            </>
          ) : (
            <Link href="/account#emergency" className={`${big} bg-white`}>
              <span aria-hidden="true">➕</span> Add an emergency contact
            </Link>
          )}

          <a href={whatsappLink(message)} target="_blank" rel="noreferrer" className={`${big} bg-white`}>
            <span aria-hidden="true">💬</span> Share live trip on WhatsApp
          </a>
          <button
            className={`${big} bg-white`}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            <span aria-hidden="true">🔗</span> {copied ? "Link copied" : "Copy live trip link"}
          </button>

          <div className="mt-2 rounded-2xl bg-white/70 p-4 text-sm">
            <p className="font-bold">Your trip</p>
            <p className="text-ink-soft">
              {driverName}
              {plate ? `, plate ${plate}` : ""}
            </p>
            <p className="mt-2 text-ink-soft">Anyone with the link sees your trip on a map until an hour after it ends.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
