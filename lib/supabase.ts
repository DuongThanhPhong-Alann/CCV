import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required to use Supabase.");
  if (!client) {
    client = createClient(url, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: {
        fetch: async (input, init) => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 7000);
          try {
            return await fetch(input, { ...init, cache: "no-store", signal: controller.signal });
          } finally {
            clearTimeout(timeout);
          }
        },
      },
    });
  }
  return client;
}
