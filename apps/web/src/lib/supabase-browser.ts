import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "./public-env";

const key = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
