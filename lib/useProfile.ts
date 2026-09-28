"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Profile } from "./types";

type State = { loading: boolean; userId?: string; profile?: Profile };

export function useProfile(): State {
  const [state, setState] = useState<State>({ loading: true });

  useEffect(() => {
    let alive = true;

    const load = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) {
        if (alive) setState({ loading: false });
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();
      if (alive) setState({ loading: false, userId: session.user.id, profile: (profile as Profile) ?? undefined });
    };

    load();
    // Supabase warns against awaiting inside this callback, so defer the reload.
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      setTimeout(load, 0);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
