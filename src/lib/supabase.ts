import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client. Uses the service role key, so this module must
 * never be imported from a "use client" component. It is created lazily so a
 * missing env var surfaces at request time rather than at build time.
 */
let cached: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. See .env.local.example."
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export type Task = {
  id: string;
  name: string;
  subtitle: string | null;
  sort_order: number;
  active: boolean;
};

export type Completion = {
  id: number;
  task_id: string;
  day: string; // YYYY-MM-DD
  status: "done" | "skipped";
  recap: string | null;
  reason: string | null;
  created_at: string;
};

/**
 * Every completion, newest first.
 *
 * PostgREST caps a plain select at 1000 rows, which at nine tasks a day would
 * quietly start truncating the log after about four months. Page through
 * instead so "every completion" stays true.
 */
export async function fetchAllCompletions(): Promise<Completion[]> {
  const db = supabase();
  const PAGE = 1000;
  const all: Completion[] = [];

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("completions")
      .select("*")
      .order("day", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;

    const rows = (data ?? []) as Completion[];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }

  return all;
}
