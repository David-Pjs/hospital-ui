// app/api/hospitals/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

/**
 * Simple GET for quick health-check / debugging.
 * Having this ensures the file exports at least one simple runtime symbol
 * so CI won't claim "not a module" if something else fails.
 */
export async function GET() {
  return NextResponse.json({ ok: true, route: "hospitals" });
}

type HospitalUpdate = Partial<{
  name: string;
  status: string;
  manual_rating: number | null;
  score: number | null;
}>;

export async function PATCH(request: Request) {
  try {
    // create the server client on-demand (lazy)
    const supabaseServer = getSupabaseServer();

    // safely parse JSON (guards against empty bodies)
    let body: { id?: string | number; updates?: HospitalUpdate } | undefined;
    try {
      body = (await request.json()) as { id?: string | number; updates?: HospitalUpdate } | undefined;
    } catch (err) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const id = body?.id;
    const updates = body?.updates;

    if (!id || !updates || Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Missing id or updates" }, { status: 400 });
    }

    // Note: .update returns { data, error } where data is an array of rows for update
    const { data, error } = await supabaseServer
      .from("hospitals")
      .update(updates)
      .eq("id", id)
      .select("id, name, status, manual_rating, score, updated_at");

    if (error) {
      console.error("Supabase update error:", error);
      return NextResponse.json({ error: error.message ?? String(error) }, { status: 500 });
    }

    // data may be an array — return the first row or the array
    const result = Array.isArray(data) ? data[0] ?? data : data;

    return NextResponse.json({ data: result }, { status: 200 });
  } catch (err: any) {
    console.error("Route PATCH error:", err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
