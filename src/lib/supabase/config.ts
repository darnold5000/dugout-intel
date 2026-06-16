const SUPABASE_ORIGIN_PATTERN = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i;

/**
 * Returns the Supabase project URL exactly once.
 * Guards against env values accidentally duplicated during deploy, e.g.:
 * https://xxx.supabase.cohttps://xxx.supabase.co
 */
export function normalizeSupabaseUrl(raw?: string): string {
  if (!raw?.trim()) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required");
  }

  let url = raw.trim();

  // Glued duplicate: https://proj.supabase.cohttps://proj.supabase.co
  const gluedMatch = url.match(
    /^(https:\/\/[a-z0-9-]+\.supabase\.co)(?:https?:?\/?\/[a-z0-9-]+\.supabase\.co)/i
  );
  if (gluedMatch) {
    url = gluedMatch[1];
  }

  // Any remaining duplicate hostname — keep first origin only
  const firstOrigin = url.match(/^https:\/\/[a-z0-9-]+\.supabase\.co/i);
  if (firstOrigin) {
    const origin = firstOrigin[0];
    const remainder = url.slice(origin.length);
    if (/supabase\.co/i.test(remainder)) {
      url = origin;
    }
  }

  url = url.replace(/\/+$/, "");

  if (!SUPABASE_ORIGIN_PATTERN.test(url)) {
    throw new Error(
      "Invalid NEXT_PUBLIC_SUPABASE_URL. Expected https://<project-ref>.supabase.co"
    );
  }

  return url;
}

export function normalizeSupabaseAnonKey(raw?: string): string {
  if (!raw?.trim()) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is required");
  }
  return raw.trim();
}

/** Single source of truth for Supabase client configuration. */
export function getSupabaseConfig() {
  return {
    url: normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: normalizeSupabaseAnonKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  };
}

export function getSupabaseHostname(): string {
  return new URL(getSupabaseConfig().url).hostname;
}
