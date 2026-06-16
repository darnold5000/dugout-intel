import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

export function createClientFromAccessToken(accessToken: string) {
  const { url, anonKey } = getSupabaseConfig();
  return createSupabaseClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}
