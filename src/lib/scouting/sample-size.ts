export type SampleConfidence = "low" | "medium" | "high";

export function pitchingSampleConfidence(
  inningsPitched: number | null | undefined,
  battersFaced: number | null | undefined
): SampleConfidence {
  const ip = inningsPitched ?? 0;
  const bf = battersFaced ?? 0;
  if (ip > 5 || bf > 15) return "high";
  if (ip >= 2 || bf >= 10) return "medium";
  return "low";
}

export function offensiveSampleConfidence(
  atBats: number | null | undefined,
  plateAppearances: number | null | undefined
): SampleConfidence {
  const observed = Math.max(atBats ?? 0, plateAppearances ?? 0);
  if (observed >= 15) return "high";
  if (observed >= 8) return "medium";
  return "low";
}

export function formatConfidenceLabel(confidence: SampleConfidence): string {
  return confidence.charAt(0).toUpperCase() + confidence.slice(1);
}

export function pitchingRoleWithSampleSize(
  role: string,
  confidence: SampleConfidence,
  inningsPitched: number | null
): string {
  if (confidence !== "low") return role;
  const ipNote =
    inningsPitched != null
      ? `Only ${inningsPitched.toFixed(1)} inning${inningsPitched === 1 ? "" : "s"} observed.`
      : "Limited innings observed.";
  return `${role} (Confidence: Low — ${ipNote})`;
}

export function estimatePlateAppearances(stats: {
  hits?: number | null;
  walks?: number | null;
  strikeouts?: number | null;
}): number {
  return (
    (stats.hits ?? 0) + (stats.walks ?? 0) + (stats.strikeouts ?? 0)
  );
}
