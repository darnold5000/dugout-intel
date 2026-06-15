/**
 * Server-side environment variable access.
 *
 * - NEXT_PUBLIC_* are available on server and client (inlined at build time).
 * - OPENAI_API_KEY and SUPABASE_SERVICE_ROLE_KEY are server-only runtime secrets.
 *
 * Never import this module from client components.
 */

export type ServerEnvKey =
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  | "OPENAI_API_KEY"
  | "SUPABASE_SERVICE_ROLE_KEY";

export function getServerEnv(key: ServerEnvKey): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/** Safe boolean checks for health/debug endpoints — never returns secret values. */
export function getServerEnvStatus(): Record<ServerEnvKey, boolean> {
  return {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

export function getPort(): number {
  const port = Number(process.env.PORT ?? 8080);
  return Number.isFinite(port) ? port : 8080;
}
