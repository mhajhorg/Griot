import { createClient as createSupabaseClient } from "@supabase/supabase-js";

let cachedClient: any = undefined;

export function getSupabaseClient(): any {
  if (cachedClient !== undefined) {
    return cachedClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key || !url.startsWith("http")) {
    cachedClient = null;
    return null;
  }

  cachedClient = createSupabaseClient(url, key);
  return cachedClient;
}

export async function safeSupabaseInsert(table: string, values: Record<string, unknown>) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { data: null, error: { message: "Supabase is not configured" } };
  }

  return supabase.from(table).insert(values).select().single();
}
