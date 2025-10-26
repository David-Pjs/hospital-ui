// lib/supabase-server.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE!;

if (!url || !serviceRole) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE");
}

export const supabaseServer = createClient(url, serviceRole, {
  auth: { persistSession: false },
});
