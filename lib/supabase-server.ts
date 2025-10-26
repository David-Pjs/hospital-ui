// lib/supabase-server.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let _serverClient: SupabaseClient | null = null;

/**
 * Return a Supabase server client. Creation is deferred until called,
 * and the function throws only if required server env is missing.
 *
 * IMPORTANT: DO NOT expose SUPABASE_SERVICE_ROLE_KEY to the browser.
 */
export function getSupabaseServer(): SupabaseClient {
  if (_serverClient) return _serverClient;

  if (!SUPABASE_URL) {
    throw new Error(
      "Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL. Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) in .env.local and in Vercel envs."
    );
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY (server-only). Add this secret to Vercel Environment Variables for this project."
    );
  }

  _serverClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  return _serverClient;
}
