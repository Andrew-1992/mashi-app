"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";

type Msg = { id: string; sender_id: string; body: string; created_at: string };

type Props = {
  rideId: string;
  userId: string;
  otherName: string;
  quickReplies: string[];
  className?: string;
};

/** Message button with unread badge, opening a full-screen chat with one-tap quick replies. */
export default function TripChat({ rideId, userId, otherName, quickReplies, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [seen, setSeen] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);
  const prevTheirs = useRef(0);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("messages")
      .select("id, sender_id, body, created_at")
      .eq("ride_id", rideId)
      .order("created_at");
    setMsgs((data ?? []) as Msg[]);
  }, [rideId]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`chat-${rideId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `ride_id=eq.${rideId}` }, () => load())
      .subscribe();
    const t = setInterval(load, open ? 4000 : 10000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(t);
    };
  }, [rideId, load, open]);

  const theirs = msgs.filter((m) => m.sender_id !== userId).length;
  const unread = open ? 0 : Math.max(0, theirs - seen);

  useEffect(() => {
    if (loaded.current && theirs > prevTheirs.current) haptic(40);
    if (msgs.length || theirs) loaded.current = true;
    prevTheirs.current = theirs;
  }, [theirs, msgs.length]);

  useEffect(() => {
    if (open) setSeen(theirs);
  }, [open, theirs]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end" });
  }, [open, msgs.length]);

  const send = async (body: string) => {
    const b = body.trim();
    if (!b) return;
    setText("");
    setError(null);
    const { error } = await supabase.rpc("send_message", { p_ride: rideId, p_body: b });
    if (error) {
      setError(error.message);
      setText(b);
      return;
    }
    haptic();
    load();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`relative flex h-11 items-center justify-center gap-2 rounded-xl bg-white font-bold ring-2 ring-ink/80 ${className}`}
      >
        <span aria-hidden="true">💬</span> Message
        {unread > 0 && (
          <span className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-murram text-xs font-bold text-white">
            {unread}
            <span className="sr-only"> unread</span>
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[800] flex flex-col bg-road" role="dialog" aria-label={`Chat with ${otherName}`}>
          <div className="flex items-center gap-3 bg-vest px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
            <button onClick={() => setOpen(false)} className="rounded-full bg-white/70 px-3 py-2 font-bold" aria-label="Back to trip">
              ←
            </button>
            <h2 className="wide truncate text-xl font-extrabold">{otherName}</h2>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
            <div className="mx-auto flex max-w-lg flex-col gap-2">
              {msgs.length === 0 && (
                <p className="mt-10 text-center text-ink-soft">Tap a quick message below, or type your own.</p>
              )}
              {msgs.map((m) => {
                const mine = m.sender_id === userId;
                return (
                  <div
                    key={m.id}
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${mine ? "self-end rounded-br-md bg-ink text-white" : "self-start rounded-bl-md bg-white"}`}
                  >
                    <p>{m.body}</p>
                    <p className={`mt-0.5 text-right text-[11px] ${mine ? "text-white/60" : "text-ink-soft"}`}>
                      {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
          </div>

          <div className="bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(27,42,65,0.08)]">
            <div className="mx-auto max-w-lg">
              {error && <p className="mb-2 text-sm font-medium text-murram">{error}</p>}
              <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
                {quickReplies.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="shrink-0 rounded-full bg-vest px-4 py-2 text-sm font-bold whitespace-nowrap"
                  >
                    {q}
                  </button>
                ))}
              </div>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  send(text);
                }}
              >
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type a message"
                  aria-label="Message"
                  maxLength={500}
                  className="h-12 flex-1 rounded-full bg-road px-4 text-base outline-none focus:ring-2 focus:ring-ink"
                  enterKeyHint="send"
                />
                <button disabled={!text.trim()} className="h-12 rounded-full bg-ink px-5 font-bold text-white disabled:opacity-40">
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
