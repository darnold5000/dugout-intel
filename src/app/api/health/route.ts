import { NextResponse } from "next/server";
import { getPort, getServerEnvStatus } from "@/lib/env";
import { getSupabaseHostname } from "@/lib/supabase/config";

export async function GET() {
  let supabaseHost: string | null = null;
  let supabaseUrlValid = false;

  try {
    supabaseHost = getSupabaseHostname();
    supabaseUrlValid = true;
  } catch {
    supabaseHost = null;
  }

  return NextResponse.json({
    status: "ok",
    service: "dugout-intel",
    port: getPort(),
    supabaseHost,
    supabaseUrlValid,
    env: getServerEnvStatus(),
  });
}
