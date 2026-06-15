import { NextResponse } from "next/server";
import { getPort, getServerEnvStatus } from "@/lib/env";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "dugout-intel",
    port: getPort(),
    env: getServerEnvStatus(),
  });
}
