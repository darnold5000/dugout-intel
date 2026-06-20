import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
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
