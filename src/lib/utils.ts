import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Parse YYYY-MM-DD as local calendar date (avoids UTC off-by-one in US timezones). */
export function parseCalendarDate(date: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (!year || month < 0 || month > 11 || !day) return null;
  return new Date(year, month, day);
}

export function formatDate(date: string | null): string {
  if (!date) return "—";
  const local = parseCalendarDate(date);
  const d = local ?? new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatStat(value: number | null, decimals = 3): string {
  if (value === null || value === undefined) return "—";
  return value.toFixed(decimals);
}

export function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return "—";
  const pct = value <= 1 ? value * 100 : value;
  return `${pct.toFixed(1)}%`;
}

/** Normalize S%, FPS%, etc. stored as either 0.62 or 62 into decimal 0–1. */
export function normalizePctDecimal(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (value > 1) return value / 100;
  return value;
}

/** Box score Pitches-Strikes line (e.g. 40 pitches, 30 strikes → "40-30"). */
export function formatPitchStrikes(
  pitches: number | null | undefined,
  strikes: number | null | undefined
): string | null {
  if (pitches == null || strikes == null) return null;
  return `${pitches}-${strikes}`;
}
