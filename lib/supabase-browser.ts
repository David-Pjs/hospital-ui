// lib/supabase-browser.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let _browserClient: SupabaseClient | null = null;

/**
 * Returns a memoized Supabase client for browser usage.
 * Throws a clear error if the NEXT_PUBLIC_* env values are missing.
 */
export function getSupabaseBrowser(): SupabaseClient {
  if (_browserClient) return _browserClient;

  if (!URL || !ANON_KEY) {
    // In dev you MUST set these in .env.local. In Vercel add NEXT_PUBLIC_* envs.
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to .env.local (dev) and to Vercel envs (Preview/Production)."
    );
  }

  _browserClient = createClient(URL, ANON_KEY, {
    realtime: { params: { eventsPerSecond: 10 } },
  });

  return _browserClient;
}
