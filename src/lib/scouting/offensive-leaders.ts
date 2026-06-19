import { isScoutablePlayerName } from "@/lib/extraction/player-identity";
import type { PlayerProfile } from "@/lib/scouting/player-profiles";

export interface OffensiveLeaderPick {
  leader_label: string;
  jersey_number: string | null;
  player_name: string;
  stat_line: string;
}

function formatAvg(value: number | null | undefined): string {
  if (value == null) return "—";
  return value < 1 ? value.toFixed(3) : value.toFixed(3);
}

function sortDesc<T>(items: T[], getter: (item: T) => number | null): T[] {
  return [...items].sort((a, b) => (getter(b) ?? -1) - (getter(a) ?? -1));
}

export function isScoutableProfile(profile: PlayerProfile): boolean {
  return isScoutablePlayerName(profile.name);
}

export function filterScoutableProfiles(profiles: PlayerProfile[]): PlayerProfile[] {
  return profiles.filter(isScoutableProfile);
}

function hasJersey(profile: PlayerProfile): boolean {
  return !!profile.jerseyNumber?.trim();
}


/** Prefer OPS → OBP → AVG → hits → runs → RBI when advanced stats are missing. */
export function resolveBestHitterPick(
  profiles: PlayerProfile[]
): OffensiveLeaderPick | null {
  const batters = filterScoutableProfiles(profiles).filter((p) => p.batting);
  if (!batters.length) return null;

  const attempts: Array<{
    label: string;
    sorted: PlayerProfile[];
    statLine: (p: PlayerProfile) => string;
    eligible: (p: PlayerProfile) => boolean;
  }> = [
    {
      label: "Highest OPS",
      sorted: sortDesc(batters, (p) => p.batting?.ops ?? null),
      statLine: (p) => `OPS ${formatAvg(p.batting?.ops)}`,
      eligible: (p) => p.batting?.ops != null,
    },
    {
      label: "Highest OBP",
      sorted: sortDesc(batters, (p) => p.batting?.obp ?? null),
      statLine: (p) => `OBP ${formatAvg(p.batting?.obp)}`,
      eligible: (p) => p.batting?.obp != null,
    },
    {
      label: "Highest AVG",
      sorted: sortDesc(batters, (p) => p.batting?.avg ?? null),
      statLine: (p) => `AVG ${formatAvg(p.batting?.avg)}`,
      eligible: (p) => p.batting?.avg != null,
    },
    {
      label: "Most Hits",
      sorted: sortDesc(batters, (p) => p.batting?.hits ?? null),
      statLine: (p) => `${p.batting?.hits ?? 0} H`,
      eligible: (p) => (p.batting?.hits ?? 0) > 0,
    },
    {
      label: "Most Runs",
      sorted: sortDesc(batters, (p) => p.batting?.runs ?? null),
      statLine: (p) => `${p.batting?.runs ?? 0} R`,
      eligible: (p) => (p.batting?.runs ?? 0) > 0,
    },
    {
      label: "Most RBI",
      sorted: sortDesc(batters, (p) => p.batting?.rbi ?? null),
      statLine: (p) => `${p.batting?.rbi ?? 0} RBI`,
      eligible: (p) => (p.batting?.rbi ?? 0) > 0,
    },
  ];

  for (const attempt of attempts) {
    const top = attempt.sorted.find(
      (p) => attempt.eligible(p) && hasJersey(p)
    );
    if (top) {
      return {
        leader_label: attempt.label,
        jersey_number: top.jerseyNumber,
        player_name: top.name ?? "Unknown",
        stat_line: attempt.statLine(top),
      };
    }
  }

  return null;
}

/** Prefer stolen bases; fall back to runs scored when SB column was not captured. */
export function resolveBestRunnerPick(
  profiles: PlayerProfile[]
): OffensiveLeaderPick | null {
  const batters = filterScoutableProfiles(profiles).filter((p) => p.batting);
  if (!batters.length) return null;

  const withSb = sortDesc(
    batters.filter((p) => hasJersey(p) && (p.batting?.stolen_bases ?? 0) > 0),
    (p) => p.batting?.stolen_bases ?? null
  );
  if (withSb[0]) {
    return {
      leader_label: "Most Stolen Bases",
      jersey_number: withSb[0].jerseyNumber,
      player_name: withSb[0].name ?? "Unknown",
      stat_line: `${withSb[0].batting!.stolen_bases} SB`,
    };
  }

  const withRuns = sortDesc(
    batters.filter((p) => hasJersey(p) && (p.batting?.runs ?? 0) > 0),
    (p) => p.batting?.runs ?? null
  );
  if (withRuns[0]) {
    return {
      leader_label: "Most Runs",
      jersey_number: withRuns[0].jerseyNumber,
      player_name: withRuns[0].name ?? "Unknown",
      stat_line: `${withRuns[0].batting!.runs} R`,
    };
  }

  return null;
}

export function offensiveLeaderPickToLeaderEntry(
  pick: OffensiveLeaderPick
): import("@/types").LeaderEntry {
  return {
    label: pick.leader_label,
    jersey_number: pick.jersey_number,
    player_name: pick.player_name,
    stat_line: pick.stat_line,
  };
}
