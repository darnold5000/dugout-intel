import {
  buildCanonicalKeyMap,
  parsePlayerIdentity,
  resolveConsolidationKey,
} from "@/lib/extraction/player-identity";
import {
  filterScoutableProfiles,
  offensiveLeaderPickToLeaderEntry,
  resolveBestHitterPick,
  resolveBestRunnerPick,
} from "@/lib/scouting/offensive-leaders";
import {
  buildPlayerProfiles,
  collectDataGaps,
  formatPlayerLabel,
  type PlayerProfile,
} from "@/lib/scouting/player-profiles";
import {
  pitchingRoleWithSampleSize,
  pitchingSampleConfidence,
} from "@/lib/scouting/sample-size";
import type {
  ConfidenceByCategory,
  ExtractedPitchingStat,
  FirstPitchAnalysis,
  LeaderEntry,
  OpponentDetail,
  PitchingLeaders,
  PitchingTierGroup,
  PlayerScoutingCard,
  ScreenshotUpload,
  TeamIdentity,
  TeamIntelligence,
  ThreatTierGroup,
} from "@/types";

interface AdvancedPitchingStats {
  first_pitch_strike_pct: number | null;
  batters_faced: number | null;
}

function pitchCount(p: ExtractedPitchingStat | null | undefined): number | null {
  if (!p) return null;
  return p.total_pitches ?? p.pitches;
}

function getWalksPerInning(profile: PlayerProfile): number | null {
  const p = profile.pitching;
  if (!p) return null;
  if (p.walks_per_inning != null) return p.walks_per_inning;
  if (!p.innings_pitched || p.innings_pitched <= 0) return null;
  return (p.walks ?? 0) / p.innings_pitched;
}

function getFps(
  profile: PlayerProfile,
  advancedMap: Map<string, AdvancedPitchingStats>
): number | null {
  if (profile.pitching?.first_pitch_strike_pct != null) {
    return profile.pitching.first_pitch_strike_pct;
  }
  return getAdvancedPitching(profile, advancedMap).first_pitch_strike_pct;
}

function sortByDesc<T>(items: T[], getter: (item: T) => number | null): T[] {
  return [...items].sort((a, b) => (getter(b) ?? -1) - (getter(a) ?? -1));
}

function formatAvg(value: number | null | undefined): string {
  if (value == null) return "—";
  return value < 1 ? value.toFixed(3) : value.toFixed(3);
}

function formatPct(value: number | null | undefined): string {
  if (value == null) return "—";
  const pct = value <= 1 ? value * 100 : value;
  return `${Math.round(pct)}%`;
}

function leader(
  label: string,
  profile: PlayerProfile,
  statLine: string,
  interpretation?: string
): LeaderEntry {
  return {
    label,
    jersey_number: profile.jerseyNumber,
    player_name: profile.name ?? "Unknown",
    stat_line: statLine,
    interpretation,
  };
}

function parseAdvancedPitchingFromUploads(
  uploads: ScreenshotUpload[],
  profiles: PlayerProfile[]
): Map<string, AdvancedPitchingStats> {
  const result = new Map<string, AdvancedPitchingStats>();
  const identityEntries = profiles.map((p) => ({
    name: p.name,
    jersey: p.jerseyNumber,
  }));
  const canonicalMap = buildCanonicalKeyMap(identityEntries);

  for (const upload of uploads) {
    const table = upload.raw_extracted_table;
    if (!table?.headers?.length) continue;

    const normalized = table.headers.map((h) =>
      h.trim().toUpperCase().replace(/\s+/g, "").replace(/%/g, "%")
    );
    const nameIdx = normalized.findIndex(
      (h) => h === "PLAYER" || h === "NAME" || h.includes("PLAYER")
    );
    const fpsIdx = normalized.findIndex(
      (h) => h === "FPS%" || h === "FPS" || h === "FPSPCT"
    );
    const bfIdx = normalized.findIndex((h) => h === "BF");

    if (nameIdx < 0) continue;

    for (const row of table.rows) {
      const rawName = row[nameIdx]?.trim();
      if (!rawName) continue;
      const parsed = parsePlayerIdentity(rawName, null);
      const key = resolveConsolidationKey(
        parsed.player_name,
        parsed.jersey_number,
        canonicalMap
      );
      if (!key) continue;

      const existing = result.get(key) ?? {
        first_pitch_strike_pct: null,
        batters_faced: null,
      };

      if (fpsIdx >= 0 && row[fpsIdx]) {
        const raw = row[fpsIdx].trim().replace(/%$/, "");
        const val = Number(raw.startsWith(".") ? `0${raw}` : raw);
        if (Number.isFinite(val)) {
          existing.first_pitch_strike_pct = val > 1 ? val / 100 : val;
        }
      }

      if (bfIdx >= 0 && row[bfIdx]) {
        const val = Number(row[bfIdx].trim());
        if (Number.isFinite(val)) existing.batters_faced = val;
      }

      result.set(key, existing);
    }
  }

  return result;
}

function getAdvancedPitching(
  profile: PlayerProfile,
  advancedMap: Map<string, AdvancedPitchingStats>
): AdvancedPitchingStats {
  return (
    advancedMap.get(profile.key) ?? {
      first_pitch_strike_pct: null,
      batters_faced: null,
    }
  );
}

function offensiveThreatScore(profile: PlayerProfile): number {
  const b = profile.batting;
  if (!b) return 0;
  return (
    (b.ops ?? b.obp ?? b.avg ?? 0) * 100 +
    (b.rbi ?? 0) * 0.5 +
    (b.runs ?? 0) * 0.3 +
    (b.stolen_bases ?? 0) * 0.2
  );
}

function buildOffensiveLeaders(
  profiles: PlayerProfile[]
): Record<string, LeaderEntry | null> {
  const scoutable = filterScoutableProfiles(profiles);
  const withBatting = scoutable.filter((p) => p.batting);

  const pick = (
    label: string,
    sorted: PlayerProfile[],
    statLine: (p: PlayerProfile) => string
  ): LeaderEntry | null => {
    const top = sorted[0];
    if (!top) return null;
    return leader(label, top, statLine(top));
  };

  const byAvg = sortByDesc(withBatting, (p) => p.batting?.avg ?? null);
  const byObp = sortByDesc(withBatting, (p) => p.batting?.obp ?? null);
  const byOps = sortByDesc(withBatting, (p) => p.batting?.ops ?? null);
  const byHits = sortByDesc(withBatting, (p) => p.batting?.hits ?? null);
  const byRbi = sortByDesc(withBatting, (p) => p.batting?.rbi ?? null);
  const byRuns = sortByDesc(withBatting, (p) => p.batting?.runs ?? null);
  const byWalks = sortByDesc(withBatting, (p) => p.batting?.walks ?? null);
  const byFewestK = [...withBatting].sort(
    (a, b) => (a.batting?.strikeouts ?? 999) - (b.batting?.strikeouts ?? 999)
  );

  const bestHitter = resolveBestHitterPick(scoutable);
  const bestRunner = resolveBestRunnerPick(scoutable);

  return {
    highest_avg: pick("Highest AVG", byAvg, (p) => `AVG ${formatAvg(p.batting?.avg)}`),
    highest_obp: pick("Highest OBP", byObp, (p) => `OBP ${formatAvg(p.batting?.obp)}`),
    highest_ops: bestHitter
      ? offensiveLeaderPickToLeaderEntry(bestHitter)
      : pick("Highest OPS", byOps, (p) => `OPS ${formatAvg(p.batting?.ops)}`),
    most_hits: pick("Most Hits", byHits, (p) => `${p.batting?.hits ?? 0} H`),
    most_rbi: pick("Most RBI", byRbi, (p) => `${p.batting?.rbi ?? 0} RBI`),
    most_runs: pick("Most Runs", byRuns, (p) => `${p.batting?.runs ?? 0} R`),
    most_walks: pick("Most Walks", byWalks, (p) => `${p.batting?.walks ?? 0} BB`),
    fewest_strikeouts: pick(
      "Fewest Strikeouts",
      byFewestK,
      (p) => `${p.batting?.strikeouts ?? 0} SO`
    ),
    most_stolen_bases: bestRunner
      ? offensiveLeaderPickToLeaderEntry(bestRunner)
      : null,
  };
}

function strikeoutRate(profile: PlayerProfile): number | null {
  const p = profile.pitching;
  if (!p?.innings_pitched || p.innings_pitched <= 0) return null;
  return (p.strikeouts ?? 0) / p.innings_pitched;
}

function buildPitchingLeaders(profiles: PlayerProfile[]): PitchingLeaders {
  const withPitching = profiles.filter(
    (p) => p.pitching?.innings_pitched != null && p.pitching.innings_pitched > 0
  );

  const byIp = sortByDesc(withPitching, (p) => p.pitching?.innings_pitched ?? null);
  const byLowWalkRate = sortByDesc(withPitching, (p) => {
    const rate = getWalksPerInning(p);
    return rate != null ? -rate : null;
  });
  const byHighKRate = sortByDesc(withPitching, strikeoutRate);
  const byHighWalkRate = sortByDesc(withPitching, getWalksPerInning);
  const byLowKRate = sortByDesc(withPitching, (p) => {
    const rate = strikeoutRate(p);
    return rate != null ? -rate : null;
  });
  const bySwingMiss = sortByDesc(withPitching, (p) => p.pitching?.swing_miss_pct ?? null);

  const ace = byIp[0];
  const strikeThrower = byLowWalkRate[0];
  const swingMiss = bySwingMiss[0] ?? byHighKRate[0];
  const controlProblems = byHighWalkRate[0];
  const contactPitcher = byLowKRate[0];

  const aceLabel = (p: PlayerProfile) => {
    const pitches = pitchCount(p.pitching);
    const bf = p.pitching?.batters_faced;
    const parts = [`${p.pitching!.innings_pitched!.toFixed(1)} IP`];
    if (pitches != null) parts.push(`${pitches} pitches`);
    if (bf != null) parts.push(`${bf} BF`);
    return parts.join(", ");
  };

  const aceRoleLabel = (p: PlayerProfile) => {
    const confidence = pitchingSampleConfidence(
      p.pitching?.innings_pitched ?? null,
      p.pitching?.batters_faced ?? null
    );
    const base =
      confidence === "low" ? "Likely Primary Pitcher" : "Primary Pitcher";
    return pitchingRoleWithSampleSize(
      base,
      confidence,
      p.pitching?.innings_pitched ?? null
    );
  };

  return {
    ace_pitcher: ace
      ? leader(
          aceRoleLabel(ace).split("(")[0].trim(),
          ace,
          aceLabel(ace),
          aceRoleLabel(ace)
        )
      : null,
    strike_thrower: strikeThrower
      ? leader(
          "Strike Thrower",
          strikeThrower,
          strikeThrower.pitching?.k_bb_ratio != null
            ? `K/BB ${strikeThrower.pitching.k_bb_ratio.toFixed(2)}`
            : `BB/INN ${(getWalksPerInning(strikeThrower) ?? 0).toFixed(2)}`,
          strikeThrower.pitching?.strike_percentage != null
            ? `Throws strikes at ${formatPct(strikeThrower.pitching.strike_percentage)} — attacks the zone.`
            : "Lowest walk rate — attacks the zone."
        )
      : null,
    swing_and_miss: swingMiss
      ? leader(
          "Swing and Miss",
          swingMiss,
          swingMiss.pitching?.swing_miss_pct != null
            ? `SM% ${formatPct(swingMiss.pitching.swing_miss_pct)}`
            : `K/INN ${(strikeoutRate(swingMiss) ?? 0).toFixed(2)}`,
          "Highest swing-and-miss profile — expect strikeouts."
        )
      : null,
    control_problems: controlProblems
      ? leader(
          "Control Problems",
          controlProblems,
          controlProblems.pitching?.walks_per_inning != null
            ? `BB/INN ${controlProblems.pitching.walks_per_inning.toFixed(2)}`
            : `BB/INN ${(getWalksPerInning(controlProblems) ?? 0).toFixed(2)}`,
          `${formatPlayerLabel(controlProblems)} has command concerns — expect free passes.`
        )
      : null,
    contact_pitcher: contactPitcher
      ? leader(
          "Contact Pitcher",
          contactPitcher,
          `K/INN ${(strikeoutRate(contactPitcher) ?? 0).toFixed(2)}`,
          "Lowest strikeout rate — pitches to contact."
        )
      : null,
  };
}

function buildBaseRunningThreats(profiles: PlayerProfile[]): LeaderEntry[] {
  return sortByDesc(
    profiles.filter((p) => (p.batting?.stolen_bases ?? 0) > 0),
    (p) => p.batting?.stolen_bases ?? null
  )
    .slice(0, 5)
    .map((p) =>
      leader(
        "Speed Threat",
        p,
        `${p.batting!.stolen_bases} SB`,
        "Aggressive on the bases — hold runners and quick release."
      )
    );
}

function buildThreatTiers(profiles: PlayerProfile[]): ThreatTierGroup {
  const hitters = sortByDesc(
    profiles.filter((p) => p.batting),
    offensiveThreatScore
  );

  const n = hitters.length;
  const tier1Count = Math.max(1, Math.ceil(n * 0.2));
  const tier2Count = Math.max(0, Math.ceil(n * 0.5) - tier1Count);

  const toLabel = (p: PlayerProfile) => formatPlayerLabel(p);

  return {
    tier_1: hitters.slice(0, tier1Count).map(toLabel),
    tier_2: hitters.slice(tier1Count, tier1Count + tier2Count).map(toLabel),
    tier_3: hitters.slice(tier1Count + tier2Count).map(toLabel),
  };
}

function pitcherWorkloadScore(profile: PlayerProfile): number {
  const p = profile.pitching;
  if (!p) return 0;
  const pitches = pitchCount(p) ?? 0;
  return (
    (p.innings_pitched ?? 0) * 3 +
    pitches * 0.05 +
    (p.batters_faced ?? 0) * 0.1
  );
}

function buildPitchingHierarchy(profiles: PlayerProfile[]): PitchingTierGroup {
  const pitchers = sortByDesc(
    profiles.filter((p) => p.pitching?.innings_pitched != null),
    pitcherWorkloadScore
  );

  const n = pitchers.length;
  if (n === 0) return { tier_1: [], tier_2: [], tier_3: [] };

  const tier1End = Math.min(2, n);
  const tier2End = Math.min(tier1End + 2, n);

  const toLabel = (p: PlayerProfile) => formatPlayerLabel(p);

  return {
    tier_1: pitchers.slice(0, tier1End).map(toLabel),
    tier_2: pitchers.slice(tier1End, tier2End).map(toLabel),
    tier_3: pitchers.slice(tier2End).map(toLabel),
  };
}

function buildFirstPitchAnalysis(
  profiles: PlayerProfile[],
  advancedMap: Map<string, AdvancedPitchingStats>
): FirstPitchAnalysis {
  const withFps = profiles
    .map((p) => ({
      profile: p,
      fps: getFps(p, advancedMap),
    }))
    .filter((x) => x.fps != null) as Array<{
    profile: PlayerProfile;
    fps: number;
  }>;

  const sorted = [...withFps].sort((a, b) => b.fps - a.fps);
  const midpoint = Math.ceil(sorted.length / 2);

  const fpsThresholdHigh = (fps: number) => (fps <= 1 ? fps * 100 : fps) >= 60;
  const fpsThresholdLow = (fps: number) => (fps <= 1 ? fps * 100 : fps) < 50;

  return {
    gets_ahead: sorted.slice(0, midpoint).map(({ profile, fps }) =>
      leader(
        "Gets Ahead",
        profile,
        `FPS% ${formatPct(fps)}`,
        fpsThresholdHigh(fps)
          ? "Works ahead in counts — expect strikes early."
          : "Moderate first-pitch strike rate."
      )
    ),
    falls_behind: [...sorted]
      .reverse()
      .slice(0, midpoint)
      .map(({ profile, fps }) =>
        leader(
          "Falls Behind",
          profile,
          `FPS% ${formatPct(fps)}`,
          fpsThresholdLow(fps)
            ? "Frequently behind in counts — patient approach pays off."
            : "Can fall behind early — work counts."
        )
      ),
  };
}

function buildPitchCountLeaders(profiles: PlayerProfile[]): LeaderEntry[] {
  return sortByDesc(
    profiles.filter((p) => (pitchCount(p.pitching) ?? 0) > 0),
    (p) => pitchCount(p.pitching)
  )
    .slice(0, 5)
    .map((p) => {
      const count = pitchCount(p.pitching)!;
      return leader(
        "Pitch Count",
        p,
        `${count} pitches`,
        `${formatPlayerLabel(p)} has thrown ${count} pitches — likely a primary pitching option.`
      );
    });
}

function classifyLevel(value: number, high: number, low: number): string {
  if (value >= high) return "Elite";
  if (value >= (high + low) / 2) return "Above Average";
  if (value >= low) return "Average";
  return "Below Average";
}

function buildTeamIdentity(profiles: PlayerProfile[]): TeamIdentity {
  const withBatting = profiles.filter((p) => p.batting);
  const withPitching = profiles.filter((p) => p.pitching?.innings_pitched);

  const avgObp =
    withBatting.reduce((s, p) => s + (p.batting?.obp ?? 0), 0) /
    Math.max(withBatting.length, 1);
  const avgOps =
    withBatting.reduce((s, p) => s + (p.batting?.ops ?? 0), 0) /
    Math.max(withBatting.length, 1);
  const totalSb = withBatting.reduce(
    (s, p) => s + (p.batting?.stolen_bases ?? 0),
    0
  );
  const avgBbRate =
    withBatting.reduce((s, p) => {
      const pa = (p.batting?.hits ?? 0) + (p.batting?.walks ?? 0) + (p.batting?.strikeouts ?? 0);
      return s + (pa > 0 ? (p.batting?.walks ?? 0) / pa : 0);
    }, 0) / Math.max(withBatting.length, 1);

  const pitcherCount = withPitching.length;
  const totalIp = withPitching.reduce(
    (s, p) => s + (p.pitching?.innings_pitched ?? 0),
    0
  );

  return {
    offensive_strength:
      avgObp >= 0.4 ? "High OBP Team" : avgObp >= 0.35 ? "Balanced Offense" : "Contact-Oriented",
    power: classifyLevel(avgOps, 0.85, 0.65),
    speed: totalSb >= 20 ? "Elite" : totalSb >= 10 ? "Above Average" : "Average",
    patience: classifyLevel(avgBbRate, 0.15, 0.08),
    pitching_depth:
      pitcherCount >= 4 && totalIp >= 30
        ? "Deep Staff"
        : pitcherCount >= 2
          ? "Moderate Depth"
          : "Limited Depth",
  };
}

function buildConfidenceByCategory(
  profiles: PlayerProfile[],
  uploads: ScreenshotUpload[]
): ConfidenceByCategory {
  const battingCount = profiles.filter((p) => p.batting?.avg != null).length;
  const pitchingCount = profiles.filter((p) => p.pitching?.innings_pitched != null).length;
  const sbCount = profiles.filter((p) => (p.batting?.stolen_bases ?? 0) > 0).length;
  const positionCount = profiles.filter((p) => p.roster?.positions?.length).length;

  const level = (count: number, threshold: number) =>
    count >= threshold ? "High" : count >= threshold / 2 ? "Medium" : "Low";

  const hasWarnings = uploads.some((u) => (u.extraction_warnings?.length ?? 0) > 0);

  return {
    offense: level(battingCount, 8),
    pitching: level(pitchingCount, 3),
    baserunning: sbCount > 0 ? "High" : battingCount > 0 ? "Medium" : "Low",
    defense: positionCount > 0 && !hasWarnings ? "Medium" : "Low",
  };
}

function buildPlayerScoutingCard(
  profile: PlayerProfile,
  role: PlayerScoutingCard["role"]
): PlayerScoutingCard {
  const parts: string[] = [];
  const b = profile.batting;
  const p = profile.pitching;

  if (b) {
    if (b.avg != null) parts.push(`AVG: ${formatAvg(b.avg)}`);
    if (b.obp != null) parts.push(`OBP: ${formatAvg(b.obp)}`);
    if (b.ops != null) parts.push(`OPS: ${formatAvg(b.ops)}`);
    if (b.hits != null) parts.push(`Hits: ${b.hits}`);
    if (b.runs != null) parts.push(`Runs: ${b.runs}`);
    if (b.rbi != null) parts.push(`RBI: ${b.rbi}`);
    if (b.stolen_bases != null) parts.push(`SB: ${b.stolen_bases}`);
  }

  if (p?.innings_pitched != null) {
    parts.push(`IP: ${p.innings_pitched.toFixed(1)}`);
    const pitches = pitchCount(p);
    if (pitches != null) parts.push(`Pitches: ${pitches}`);
    if (p.batters_faced != null) parts.push(`BF: ${p.batters_faced}`);
    if (p.first_pitch_strike_pct != null)
      parts.push(`FPS%: ${formatPct(p.first_pitch_strike_pct)}`);
    if (p.era != null) parts.push(`ERA: ${p.era.toFixed(2)}`);
    if (p.strikeouts != null) parts.push(`SO: ${p.strikeouts}`);
    if (p.strike_percentage != null)
      parts.push(`S%: ${formatPct(p.strike_percentage)}`);
    if (p.walks_per_inning != null)
      parts.push(`BB/INN: ${p.walks_per_inning.toFixed(2)}`);
  }

  let assessment = "Limited data available.";
  let howToAttack = "Scout in-game and adjust our approach.";

  if (b && role !== "pitcher") {
    const ops = b.ops ?? b.obp ?? b.avg ?? 0;
    if (ops >= 1.0) {
      assessment = "Most dangerous offensive player on their roster.";
      howToAttack =
        "Our pitching: avoid free passes; pitch around in leverage spots; hold runners.";
    } else if (ops >= 0.8) {
      assessment = "Solid contributor — can hurt us in key spots.";
      howToAttack =
        "Our pitching: limit mistakes; don't groove pitches in RBI situations.";
    } else if ((b.strikeouts ?? 0) >= 8 && (b.avg ?? 1) < 0.25) {
      assessment = "Strikeout-prone — chases and misses.";
      howToAttack =
        "Our pitching: attack the zone early; expand the strike zone with two strikes.";
    } else if ((b.walks ?? 0) >= 5) {
      assessment = "Patient hitter — works counts and takes walks.";
      howToAttack =
        "Our pitching: throw strikes on the first pitch; don't nibble or fall behind.";
    } else {
      assessment = "Capable contact hitter — respect but can be pitched to.";
      howToAttack =
        "Our pitching: standard approach — execute locations and trust your defense.";
    }

    if ((b.stolen_bases ?? 0) >= 8) {
      howToAttack += " Our defense: hold runners and quick catcher release.";
    }
  }

  if (p?.innings_pitched != null && role !== "hitter") {
    const kRate = strikeoutRate(profile) ?? 0;
    const wRate = getWalksPerInning(profile) ?? 0;
    const fps = p.first_pitch_strike_pct;
    const label = formatPlayerLabel(profile);
    const pitches = pitchCount(p);

    if (fps != null && (fps <= 1 ? fps * 100 : fps) >= 60) {
      assessment = `${label} works ahead in counts (${formatPct(fps)} first-pitch strikes).`;
      howToAttack =
        "Our hitters: be ready on the first pitch; attack hittable strikes early.";
    } else if (
      fps != null &&
      (fps <= 1 ? fps * 100 : fps) < 50 &&
      wRate >= 0.8
    ) {
      assessment = `${label} has command concerns — falls behind in counts.`;
      howToAttack =
        "Our hitters: take pitches; work counts; don't chase until they prove the zone.";
    } else if (kRate >= 1.5 || (p.swing_miss_pct ?? 0) > 30) {
      assessment = `${label} is a swing-and-miss arm — generates strikeouts.`;
      howToAttack =
        "Our hitters: shorten the swing; battle; put the ball in play.";
    } else if (wRate >= 1.0) {
      assessment = `${label} struggles with command — walks batters.`;
      howToAttack =
        "Our hitters: be patient; make them throw strikes; take walks when offered.";
    } else if ((p.innings_pitched ?? 0) >= 8 || (pitches ?? 0) >= 150) {
      assessment = `${label} appears to be their primary pitcher (${p.innings_pitched!.toFixed(1)} IP${pitches != null ? `, ${pitches} pitches` : ""}).`;
      howToAttack =
        "Our hitters: pressure them early in the count before they settle in.";
    } else {
      assessment = `${label} — limited pitching sample observed.`;
      howToAttack =
        "Our hitters: scout their tendencies in-game and adjust approach.";
    }
  }

  return {
    jersey_number: profile.jerseyNumber,
    player_name: profile.name ?? "Unknown",
    key_stats: parts.join("\n"),
    assessment,
    how_to_attack: howToAttack,
    role,
  };
}

export function buildTeamIntelligence(data: OpponentDetail): TeamIntelligence {
  const profiles = buildPlayerProfiles(data);
  const advancedMap = parseAdvancedPitchingFromUploads(
    data.screenshot_uploads,
    profiles
  );
  const offensiveLeaders = buildOffensiveLeaders(profiles);
  const pitchingLeaders = buildPitchingLeaders(profiles);
  const baseRunningThreats = buildBaseRunningThreats(profiles);
  const lineupThreatTiers = buildThreatTiers(profiles);
  const pitchingHierarchy = buildPitchingHierarchy(profiles);
  const firstPitchAnalysis = buildFirstPitchAnalysis(profiles, advancedMap);
  const pitchCountLeaders = buildPitchCountLeaders(profiles);
  const teamIdentity = buildTeamIdentity(profiles);
  const confidenceByCategory = buildConfidenceByCategory(
    profiles,
    data.screenshot_uploads
  );

  const topHitters = sortByDesc(
    profiles.filter((p) => p.batting),
    offensiveThreatScore
  ).slice(0, 5);

  const weakHitters = profiles
    .filter((p) => {
      const b = p.batting;
      if (!b) return false;
      return (
        (b.avg != null && b.avg < 0.2) ||
        (b.obp != null && b.obp < 0.3) ||
        (b.strikeouts != null && b.strikeouts >= 5)
      );
    })
    .slice(0, 5);

  const playerScoutingCards: PlayerScoutingCard[] = [];
  const cardKeys = new Set<string>();

  const addCard = (profile: PlayerProfile, role: PlayerScoutingCard["role"]) => {
    if (cardKeys.has(profile.key)) return;
    cardKeys.add(profile.key);
    playerScoutingCards.push(buildPlayerScoutingCard(profile, role));
  };

  for (const p of topHitters) {
    addCard(p, p.pitching?.innings_pitched ? "two-way" : "hitter");
  }

  for (const p of sortByDesc(
    profiles.filter((p) => p.pitching?.innings_pitched),
    (p) => p.pitching?.innings_pitched ?? null
  ).slice(0, 3)) {
    addCard(p, "pitcher");
  }

  const playersToAttack = weakHitters.map((p) =>
    buildPlayerScoutingCard(p, "hitter")
  );
  const playersToAvoid = topHitters.slice(0, 3).map((p) =>
    buildPlayerScoutingCard(p, p.pitching ? "two-way" : "hitter")
  );

  const dataGaps = collectDataGaps(data.screenshot_uploads, profiles);
  const hasPersistedFps = profiles.some(
    (p) => p.pitching?.first_pitch_strike_pct != null
  );
  if (!hasPersistedFps && firstPitchAnalysis.gets_ahead.length === 0) {
    dataGaps.push("First-pitch strike data not available — upload advanced pitching screenshots.");
  }

  return {
    profiles,
    offensiveLeaders,
    pitchingLeaders,
    baseRunningThreats,
    lineupThreatTiers,
    pitchingHierarchy,
    firstPitchAnalysis,
    pitchCountLeaders,
    teamIdentity,
    confidenceByCategory,
    playerScoutingCards,
    playersToAttack,
    playersToAvoid,
    dataGaps,
  };
}

export function intelligenceToReportJson(
  intelligence: TeamIntelligence,
  aiNarrative?: Partial<{
    opponent_summary: string;
    offensive_tendencies: string;
    pitching_notes: string;
    suggested_game_plan: string;
  }>,
  extras?: {
    pitchingStaffBreakdown?: string;
  }
): import("@/types").ScoutingReportJson {
  const { teamIdentity, confidenceByCategory } = intelligence;

  const offensiveLeaderList = Object.values(intelligence.offensiveLeaders).filter(
    Boolean
  ) as LeaderEntry[];

  const playersToWatch = intelligence.playerScoutingCards
    .slice(0, 5)
    .map((c) => {
      const jersey = c.jersey_number ? `#${c.jersey_number} ` : "";
      const approach = c.how_to_attack ?? c.game_plan ?? "";
      return `${jersey}${c.player_name}\n${c.key_stats}\nAssessment: ${c.assessment}\nHow To Attack: ${approach}`;
    });

  const offensiveTendencies =
    aiNarrative?.offensive_tendencies ??
    [
      `${teamIdentity.offensive_strength}. Power: ${teamIdentity.power}. Speed: ${teamIdentity.speed}. Patience: ${teamIdentity.patience}.`,
      intelligence.baseRunningThreats.length > 0
        ? `Top base running threats: ${intelligence.baseRunningThreats.map((t) => `${t.player_name} (${t.stat_line})`).join(", ")}.`
        : "",
      intelligence.lineupThreatTiers.tier_1.length > 0
        ? `Tier 1 hitters: ${intelligence.lineupThreatTiers.tier_1.join(", ")}.`
        : "",
    ]
      .filter(Boolean)
      .join(" ");

  const pitchingNotes =
    aiNarrative?.pitching_notes ??
    [
      intelligence.pitchingLeaders.ace_pitcher
        ? `${formatPlayerLabel({ name: intelligence.pitchingLeaders.ace_pitcher.player_name, jerseyNumber: intelligence.pitchingLeaders.ace_pitcher.jersey_number } as PlayerProfile)}: ${intelligence.pitchingLeaders.ace_pitcher.interpretation ?? intelligence.pitchingLeaders.ace_pitcher.stat_line}`
        : "",
      intelligence.firstPitchAnalysis.gets_ahead.length > 0
        ? `Gets ahead: ${intelligence.firstPitchAnalysis.gets_ahead.map((p) => `${p.jersey_number ? `#${p.jersey_number} ` : ""}${p.player_name} (${p.stat_line})`).join("; ")}.`
        : "",
      intelligence.firstPitchAnalysis.falls_behind.length > 0
        ? `Falls behind: ${intelligence.firstPitchAnalysis.falls_behind.map((p) => `${p.jersey_number ? `#${p.jersey_number} ` : ""}${p.player_name} (${p.stat_line})`).join("; ")}.`
        : "",
      intelligence.pitchingLeaders.control_problems
        ? intelligence.pitchingLeaders.control_problems.interpretation
        : "",
      intelligence.pitchingHierarchy.tier_1.length > 0
        ? `Primary pitchers: ${intelligence.pitchingHierarchy.tier_1.join(", ")}.`
        : "",
    ]
      .filter(Boolean)
      .join(" ");

  return {
    executive_summary:
      aiNarrative?.opponent_summary ??
      `Scouting report based on ${intelligence.profiles.length} consolidated players. ${teamIdentity.offensive_strength} with ${teamIdentity.speed} speed and ${teamIdentity.pitching_depth.toLowerCase()}.`,
    opponent_summary:
      aiNarrative?.opponent_summary ??
      `Scouting report based on ${intelligence.profiles.length} consolidated players. ${teamIdentity.offensive_strength} with ${teamIdentity.speed} speed and ${teamIdentity.pitching_depth.toLowerCase()}.`,
    offensive_tendencies: offensiveTendencies,
    offensive_threats: offensiveTendencies,
    pitching_notes: pitchingNotes,
    pitching_staff_breakdown: extras?.pitchingStaffBreakdown ?? pitchingNotes,
    recommended_game_plan:
      aiNarrative?.suggested_game_plan ??
      [
        intelligence.baseRunningThreats.length > 0
          ? "Hold runners, slide step, quick catcher release."
          : "",
        intelligence.playersToAvoid.length > 0
          ? intelligence.playersToAvoid
              .map(
                (p) =>
                  `${p.jersey_number ? `#${p.jersey_number} ` : ""}${p.player_name}: ${p.how_to_attack ?? p.game_plan ?? ""}`
              )
              .join(" ")
          : "",
        "Execute your team's strengths against their weak spots.",
      ]
        .filter(Boolean)
        .join(" "),
    players_to_watch: playersToWatch,
    weaknesses_opportunities:
      intelligence.playersToAttack.length > 0
        ? `Attack: ${intelligence.playersToAttack.map((p) => p.player_name).join(", ")}. ${intelligence.playersToAttack[0]?.how_to_attack ?? intelligence.playersToAttack[0]?.game_plan ?? ""}`
        : "Look for strikeout-prone hitters and pitchers with control issues.",
    suggested_game_plan:
      aiNarrative?.suggested_game_plan ??
      [
        intelligence.baseRunningThreats.length > 0
          ? "Hold runners, slide step, quick catcher release."
          : "",
        intelligence.playersToAvoid.length > 0
          ? `Avoid pitching to: ${intelligence.playersToAvoid.map((p) => `${p.jersey_number ? `#${p.jersey_number} ` : ""}${p.player_name}`).join(", ")}.`
          : "",
        "Execute your team's strengths against their weak spots.",
      ]
        .filter(Boolean)
        .join(" "),
    evidence_and_confidence: `Offense: ${confidenceByCategory.offense} | Pitching: ${confidenceByCategory.pitching} | Baserunning: ${confidenceByCategory.baserunning} | Defense: ${confidenceByCategory.defense}`,
    confidence_level: `Offense: ${confidenceByCategory.offense} | Pitching: ${confidenceByCategory.pitching} | Baserunning: ${confidenceByCategory.baserunning} | Defense: ${confidenceByCategory.defense}`,
    unknowns_data_gaps: intelligence.dataGaps,
    team_identity: teamIdentity,
    confidence_by_category: confidenceByCategory,
    offensive_leaders: offensiveLeaderList,
    pitching_leaders: intelligence.pitchingLeaders,
    player_scouting_cards: intelligence.playerScoutingCards,
    base_running_threats: intelligence.baseRunningThreats,
    lineup_threat_tiers: intelligence.lineupThreatTiers,
    pitching_hierarchy: intelligence.pitchingHierarchy,
    first_pitch_strike_analysis: intelligence.firstPitchAnalysis,
    pitch_count_leaders: intelligence.pitchCountLeaders,
    players_to_attack: intelligence.playersToAttack.map((p) => p.player_name),
    players_to_avoid: intelligence.playersToAvoid.map((p) => p.player_name),
  };
}

export function formatIntelligenceReportText(
  opponentName: string,
  report: import("@/types").ScoutingReportJson
): string {
  const lines: string[] = [
    `# Scouting Report: ${opponentName}`,
    "",
    "## Opponent Summary",
    report.opponent_summary,
    "",
  ];

  if (report.team_identity) {
    lines.push(
      "## Team Identity",
      `Offensive Strength: ${report.team_identity.offensive_strength}`,
      `Power: ${report.team_identity.power}`,
      `Speed: ${report.team_identity.speed}`,
      `Patience: ${report.team_identity.patience}`,
      `Pitching: ${report.team_identity.pitching_depth}`,
      ""
    );
  }

  if (report.confidence_by_category) {
    lines.push(
      "## Confidence",
      `Offense: ${report.confidence_by_category.offense}`,
      `Pitching: ${report.confidence_by_category.pitching}`,
      `Baserunning: ${report.confidence_by_category.baserunning}`,
      `Defense: ${report.confidence_by_category.defense}`,
      ""
    );
  }

  if (report.offensive_leaders?.length) {
    lines.push("## Offensive Leaders");
    for (const l of report.offensive_leaders) {
      lines.push(`- ${l.label}: #${l.jersey_number ?? "?"} ${l.player_name} — ${l.stat_line}`);
    }
    lines.push("");
  }

  if (report.pitching_leaders) {
    lines.push("## Pitching Leaders");
    for (const l of Object.values(report.pitching_leaders).filter(Boolean)) {
      lines.push(`- ${l!.label}: #${l!.jersey_number ?? "?"} ${l!.player_name} — ${l!.stat_line}`);
      if (l!.interpretation) lines.push(`  ${l!.interpretation}`);
    }
    lines.push("");
  }

  if (report.player_scouting_cards?.length) {
    lines.push("## Players to Watch");
    for (const card of report.player_scouting_cards) {
      const jersey = card.jersey_number ? `#${card.jersey_number} ` : "";
      lines.push(
        `### ${jersey}${card.player_name}`,
        card.key_stats,
        `Assessment: ${card.assessment}`,
        `How To Attack: ${card.how_to_attack ?? card.game_plan ?? ""}`,
        ""
      );
    }
  }

  lines.push(
    "## Offensive Tendencies",
    report.offensive_tendencies,
    "",
    "## Pitching Notes",
    report.pitching_notes,
    ""
  );

  if (report.base_running_threats?.length) {
    lines.push("## Base Running Threats");
    for (const t of report.base_running_threats) {
      lines.push(`- #${t.jersey_number ?? "?"} ${t.player_name}: ${t.stat_line}`);
    }
    lines.push("Our defense: hold runners, slide step, quick catcher release.", "");
  }

  if (report.pitching_hierarchy) {
    lines.push(
      "## Pitching Hierarchy",
      `Tier 1: ${report.pitching_hierarchy.tier_1.join(", ") || "None"}`,
      `Tier 2: ${report.pitching_hierarchy.tier_2.join(", ") || "None"}`,
      `Tier 3: ${report.pitching_hierarchy.tier_3.join(", ") || "None"}`,
      ""
    );
  }

  if (report.first_pitch_strike_analysis) {
    lines.push("## First Pitch Strike Analysis");
    if (report.first_pitch_strike_analysis.gets_ahead.length) {
      lines.push("Pitchers Who Get Ahead:");
      for (const p of report.first_pitch_strike_analysis.gets_ahead) {
        lines.push(`- #${p.jersey_number ?? "?"} ${p.player_name}: ${p.stat_line}`);
      }
    }
    if (report.first_pitch_strike_analysis.falls_behind.length) {
      lines.push("Pitchers Who Fall Behind:");
      for (const p of report.first_pitch_strike_analysis.falls_behind) {
        lines.push(`- #${p.jersey_number ?? "?"} ${p.player_name}: ${p.stat_line}`);
      }
    }
    lines.push("");
  }

  lines.push(
    "## Weaknesses / Opportunities",
    report.weaknesses_opportunities,
    "",
    "## Suggested Game Plan",
    report.suggested_game_plan,
    ""
  );

  if (report.unknowns_data_gaps.length > 0) {
    lines.push("## Data Gaps");
    for (const gap of report.unknowns_data_gaps) {
      lines.push(`- ${gap}`);
    }
  }

  return lines.join("\n");
}
