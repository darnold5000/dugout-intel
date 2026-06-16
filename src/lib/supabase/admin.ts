import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";
import { getServerEnv } from "@/lib/env";

export function createServiceClient() {
  const { url } = getSupabaseConfig();
  return createClient(url, getServerEnv("SUPABASE_SERVICE_ROLE_KEY"));
}
