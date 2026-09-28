import { createClient } from "@supabase/supabase-js";

// Publishable key: safe to include in browser code.
const url = "https://vzmossyzwxibupxinnos.supabase.co";
const anonKey = "sb_publishable_-EUcI1wiBnmUS_1pvweMFw_3qEmHx7I";

if (typeof window !== "undefined") console.info("Mashi is using Supabase at", url);

export const supabase = createClient(url, anonKey);
