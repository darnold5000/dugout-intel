import {
  buildCanonicalKeyMap,
  isScoutablePlayerName,
  parsePlayerIdentity,
  resolveConsolidationKey,
} from "@/lib/extraction/player-identity";
import { enrichPitchingStatForDisplay } from "@/lib/scouting/pitching-derived";
import {
  mergeBattingRowsAccumulating,
  mergePitchingRowsAccumulating,
} from "@/lib/extraction/stat-merge";
import type {
  ExtractedBattingStat,
  ExtractedPitchingStat,
  ExtractedPlayer,
  OpponentDetail,
  ScreenshotUpload,
} from "@/types";

export interface PlayerProfile {
  key: string;
  name: string | null;
  jerseyNumber: string | null;
  batting: ExtractedBattingStat | null;
  pitching: ExtractedPitchingStat | null;
  roster: ExtractedPlayer | null;
  sourceUploadIds: string[];
  confidence: number;
  needsReview: boolean;
  reviewReasons: string[];
}

export interface ScoutingInsights {
  topHitters: PlayerProfile[];
  onBaseThreats: PlayerProfile[];
  powerProduction: PlayerProfile[];
  speedThreats: PlayerProfile[];
  pitchersToKnow: PlayerProfile[];
  weakSpots: PlayerProfile[];
  dataGaps: string[];
}

function uniqueUploadIds(ids: string[]): string[] {
  return Array.from(new Set(ids.filter(Boolean)));
}

function maxConfidence(...values: number[]): number {
  return values.length ? Math.max(...values) : 0;
}

function buildReviewReasons(
  parsed: ReturnType<typeof parsePlayerIdentity>,
  confidence: number,
  hasConflict: boolean,
  hasWarning: boolean
): string[] {
  const reasons: string[] = [];
  if (confidence < 0.9) reasons.push("Low confidence extraction");
  if (!parsed.jersey_number && parsed.player_name) {
    reasons.push("Jersey number missing");
  }
  if (parsed.unparsed_jersey_pattern) {
    reasons.push("Name may contain unparsed jersey number");
  }
  if (hasConflict) reasons.push("Stat conflict across screenshots");
  if (hasWarning) reasons.push("Screenshot extraction warning");
  return reasons;
}

export function buildPlayerProfiles(data: OpponentDetail): PlayerProfile[] {
  const conflictWarnings = new Set(
    (data.screenshot_uploads ?? [])
      .flatMap((u) => u.extraction_warnings ?? [])
      .filter(Boolean)
  );
  const hasScreenshotWarnings = conflictWarnings.size > 0;

  const identityEntries = [
    ...data.extracted_players.map((p) => ({ name: p.name, jersey: p.jersey_number })),
    ...data.extracted_batting_stats.map((s) => ({
      name: s.player_name,
      jersey: s.jersey_number,
    })),
    ...data.extracted_pitching_stats.map((s) => ({
      name: s.player_name,
      jersey: s.jersey_number,
    })),
  ];
  const canonicalMap = buildCanonicalKeyMap(identityEntries);

  const profileMap = new Map<string, PlayerProfile>();

  const ensureProfile = (
    name: string | null,
    jersey: string | null
  ): PlayerProfile | null => {
    const key = resolveConsolidationKey(name, jersey, canonicalMap);
    if (!key) return null;

    const parsed = parsePlayerIdentity(name, jersey);
    let profile = profileMap.get(key);
    if (!profile) {
      profile = {
        key,
        name: parsed.player_name,
        jerseyNumber: parsed.jersey_number,
        batting: null,
        pitching: null,
        roster: null,
        sourceUploadIds: [],
        confidence: 0,
        needsReview: false,
        reviewReasons: [],
      };
      profileMap.set(key, profile);
    }

    if (parsed.player_name && (!profile.name || parsed.player_name.length > profile.name.length)) {
      profile.name = parsed.player_name;
    }
    if (parsed.jersey_number && !profile.jerseyNumber) {
      profile.jerseyNumber = parsed.jersey_number;
    }

    return profile;
  };

  for (const player of data.extracted_players) {
    const profile = ensureProfile(player.name, player.jersey_number);
    if (!profile) continue;
    profile.roster = player;
    profile.sourceUploadIds = uniqueUploadIds([
      ...profile.sourceUploadIds,
      player.source_upload_id ?? "",
    ]);
    profile.confidence = maxConfidence(profile.confidence, player.confidence);
  }

  for (const stat of data.extracted_batting_stats) {
    const profile = ensureProfile(stat.player_name, stat.jersey_number);
    if (!profile) continue;
    profile.batting = profile.batting
      ? mergeBattingStat(profile.batting, stat)
      : stat;
    profile.sourceUploadIds = uniqueUploadIds([
      ...profile.sourceUploadIds,
      ...(stat.source_upload_ids ?? []),
      stat.source_upload_id ?? "",
    ]);
    profile.confidence = maxConfidence(profile.confidence, stat.confidence);
  }

  for (const stat of data.extracted_pitching_stats) {
    const profile = ensureProfile(stat.player_name, stat.jersey_number);
    if (!profile) continue;
    profile.pitching = profile.pitching
      ? mergePitchingStat(profile.pitching, stat)
      : stat;
    profile.sourceUploadIds = uniqueUploadIds([
      ...profile.sourceUploadIds,
      ...(stat.source_upload_ids ?? []),
      stat.source_upload_id ?? "",
    ]);
    profile.confidence = maxConfidence(profile.confidence, stat.confidence);
  }

  for (const profile of profileMap.values()) {
    const parsed = parsePlayerIdentity(profile.name, profile.jerseyNumber);
    const reasons = buildReviewReasons(
      parsed,
      profile.confidence,
      false,
      hasScreenshotWarnings
    );
    profile.reviewReasons = reasons;
    profile.needsReview = reasons.length > 0;
  }

  backfillNamesFromJersey(profileMap);

  return Array.from(profileMap.values())
    .filter((p) => isScoutablePlayerName(p.name))
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
}

function backfillNamesFromJersey(profileMap: Map<string, PlayerProfile>): void {
  const nameByJersey = new Map<string, string>();
  for (const profile of profileMap.values()) {
    if (profile.jerseyNumber && isScoutablePlayerName(profile.name)) {
      const existing = nameByJersey.get(profile.jerseyNumber);
      if (!existing || profile.name!.length > existing.length) {
        nameByJersey.set(profile.jerseyNumber, profile.name!);
      }
    }
  }
  for (const profile of profileMap.values()) {
    if (!isScoutablePlayerName(profile.name) && profile.jerseyNumber) {
      const resolved = nameByJersey.get(profile.jerseyNumber);
      if (resolved) {
        profile.name = resolved;
      }
    }
  }
}

function sortByDesc<T>(items: T[], getter: (item: T) => number | null): T[] {
  return [...items].sort((a, b) => (getter(b) ?? -1) - (getter(a) ?? -1));
}

export function buildScoutingInsights(profiles: PlayerProfile[]): ScoutingInsights {
  const withBatting = profiles.filter((p) => p.batting);
  const withPitching = profiles.filter((p) => p.pitching?.innings_pitched != null);

  const topHitters = sortByDesc(withBatting, (p) => p.batting?.ops ?? p.batting?.obp ?? p.batting?.avg ?? null).slice(0, 5);
  const onBaseThreats = sortByDesc(withBatting, (p) => p.batting?.obp ?? null).slice(0, 5);
  const powerProduction = sortByDesc(
    withBatting,
    (p) => (p.batting?.ops ?? 0) + (p.batting?.rbi ?? 0) * 0.01
  ).slice(0, 5);
  const speedThreats = sortByDesc(withBatting, (p) => p.batting?.stolen_bases ?? null)
    .filter((p) => (p.batting?.stolen_bases ?? 0) > 0)
    .slice(0, 5);
  const pitchersToKnow = sortByDesc(withPitching, (p) => p.pitching?.innings_pitched ?? null).slice(0, 5);

  const weakSpots = sortByDesc(
    withBatting.filter((p) => {
      const b = p.batting!;
      const lowAvg = b.avg != null && b.avg < 0.2;
      const lowObp = b.obp != null && b.obp < 0.3;
      const highSo = b.strikeouts != null && b.strikeouts >= 5;
      return lowAvg || lowObp || highSo;
    }),
    (p) => p.batting?.strikeouts ?? 0
  ).slice(0, 5);

  return {
    topHitters,
    onBaseThreats,
    powerProduction,
    speedThreats,
    pitchersToKnow,
    weakSpots,
    dataGaps: [],
  };
}

export function collectDataGaps(
  uploads: ScreenshotUpload[],
  profiles: PlayerProfile[]
): string[] {
  const gaps: string[] = [];
  const warnings = uploads.flatMap((u) => u.extraction_warnings ?? []);

  if (!profiles.some((p) => p.pitching?.strikeouts != null)) {
    gaps.push("Pitching strikeouts were not readable from screenshots.");
  }
  if (!profiles.some((p) => p.roster?.positions?.length)) {
    gaps.push("Defensive positions not available.");
  }
  if (warnings.some((w) => w.toLowerCase().includes("numeric"))) {
    gaps.push("Some stat columns could not be read clearly.");
  }
  if (profiles.some((p) => p.reviewReasons.includes("Jersey number missing"))) {
    gaps.push("Some players are missing jersey numbers.");
  }

  return gaps;
}


function hasNewUploadSource(
  existing: ExtractedBattingStat | ExtractedPitchingStat,
  incoming: ExtractedBattingStat | ExtractedPitchingStat
): boolean {
  const existingIds = new Set(
    uniqueUploadIds([
      ...(existing.source_upload_ids ?? []),
      existing.source_upload_id ?? "",
    ])
  );
  const incomingIds = uniqueUploadIds([
    ...(incoming.source_upload_ids ?? []),
    incoming.source_upload_id ?? "",
  ]);
  return incomingIds.some((id) => !existingIds.has(id));
}

function mergeBattingStat(
  existing: ExtractedBattingStat,
  incoming: ExtractedBattingStat
): ExtractedBattingStat {
  const merged = mergeBattingRowsAccumulating(
    existing,
    incoming,
    hasNewUploadSource(existing, incoming)
  );

  return {
    ...existing,
    ...merged,
    source_upload_ids: uniqueUploadIds([
      ...(existing.source_upload_ids ?? []),
      ...(incoming.source_upload_ids ?? []),
      existing.source_upload_id ?? "",
      incoming.source_upload_id ?? "",
    ]),
    confidence: maxConfidence(existing.confidence, incoming.confidence),
    player_name: merged.player_name ?? existing.player_name ?? incoming.player_name,
    jersey_number:
      merged.jersey_number ?? existing.jersey_number ?? incoming.jersey_number,
  };
}

function mergePitchingStat(
  existing: ExtractedPitchingStat,
  incoming: ExtractedPitchingStat
): ExtractedPitchingStat {
  const merged = mergePitchingRowsAccumulating(
    existing,
    incoming,
    hasNewUploadSource(existing, incoming)
  );

  return {
    ...existing,
    ...merged,
    source_upload_ids: uniqueUploadIds([
      ...(existing.source_upload_ids ?? []),
      ...(incoming.source_upload_ids ?? []),
      existing.source_upload_id ?? "",
      incoming.source_upload_id ?? "",
    ]),
    confidence: maxConfidence(existing.confidence, incoming.confidence),
    player_name: merged.player_name ?? existing.player_name ?? incoming.player_name,
    jersey_number:
      merged.jersey_number ?? existing.jersey_number ?? incoming.jersey_number,
  };
}

export function formatPlayerDisplayLabel(profile: {
  name: string | null;
  jerseyNumber: string | null;
}): string {
  if (profile.jerseyNumber && profile.name) {
    return `#${profile.jerseyNumber} ${profile.name}`;
  }
  if (profile.jerseyNumber) return `#${profile.jerseyNumber}`;
  return profile.name ?? "Unknown";
}

export function formatPlayerLabel(profile: PlayerProfile): string {
  return formatPlayerDisplayLabel(profile);
}

export function getConsolidatedPitchingStats(
  data: OpponentDetail
): ExtractedPitchingStat[] {
  return buildPlayerProfiles(data)
    .filter((p) => p.pitching)
    .map((p) =>
      enrichPitchingStatForDisplay({
        ...p.pitching!,
        player_name: p.name,
        jersey_number: p.jerseyNumber,
      })
    );
}

export function battingSummary(profile: PlayerProfile): string {
  const b = profile.batting;
  if (!b) return "No batting data";
  const parts: string[] = [];
  if (b.avg != null) parts.push(`AVG ${b.avg.toFixed(3)}`);
  if (b.obp != null) parts.push(`OBP ${b.obp.toFixed(3)}`);
  if (b.ops != null) parts.push(`OPS ${b.ops.toFixed(3)}`);
  if (b.hits != null) parts.push(`H ${b.hits}`);
  if (b.rbi != null) parts.push(`RBI ${b.rbi}`);
  return parts.length ? parts.join(" | ") : "Batting stats partial";
}

export function pitchingSummary(profile: PlayerProfile): string {
  const p = profile.pitching;
  if (!p) return "No pitching data";
  const parts: string[] = [];
  if (p.innings_pitched != null) parts.push(`${p.innings_pitched.toFixed(1)} IP`);
  const pitches = p.total_pitches ?? p.pitches;
  if (pitches != null) parts.push(`${pitches} P`);
  if (p.first_pitch_strike_pct != null)
    parts.push(`FPS% ${p.first_pitch_strike_pct <= 1 ? (p.first_pitch_strike_pct * 100).toFixed(0) : p.first_pitch_strike_pct.toFixed(0)}`);
  if (p.era != null) parts.push(`ERA ${p.era.toFixed(2)}`);
  if (p.strikeouts != null) parts.push(`K ${p.strikeouts}`);
  return parts.length ? parts.join(" | ") : "Pitching stats partial";
}
