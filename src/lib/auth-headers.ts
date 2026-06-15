import { createClient } from "@/lib/supabase/client";

export async function getAuthHeaders(): Promise<HeadersInit> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Not authenticated. Please sign in again.");
  }
  return { Authorization: `Bearer ${session.access_token}` };
}
