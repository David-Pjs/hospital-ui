// lib/supabase-server.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Create and return a Supabase server client when called.
 * Throws only when called and required env is missing.
 */
export function getSupabaseServer(): SupabaseClient {
  if (!SUPABASE_URL) {
    throw new Error("Missing SUPABASE_URL (set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL).");
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY (server-only).");
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}
