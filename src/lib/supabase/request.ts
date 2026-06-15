import { createClientFromAccessToken } from "@/lib/supabase/token";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function getSupabaseFromRequest(
  request: Request
): Promise<SupabaseClient> {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const accessToken = authHeader.slice("Bearer ".length).trim();
    if (accessToken) {
      return createClientFromAccessToken(accessToken);
    }
  }
  const { createClient } = await import("@/lib/supabase/server");
  return createClient();
}
