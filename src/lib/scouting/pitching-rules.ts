import type { PitchingRulesConfig } from "@/types";

/** Default USSSA-style 9U–12U profile — override via pitching_rule_profiles. */
export const DEFAULT_PITCHING_RULES: PitchingRulesConfig = {
  max_innings_per_day: 6,
  innings_trigger_rest_day: 3,
  rest_days_after_heavy_day: 1,
  max_innings_rolling_window: 8,
  rolling_window_days: 3,
  max_pitches_per_day: 85,
  tournament_innings_cap: 8,
};

export function normalizeRules(
  rules?: PitchingRulesConfig | null
): PitchingRulesConfig {
  return { ...DEFAULT_PITCHING_RULES, ...rules };
}

export const DEFAULT_RULES_PROFILE_LABEL = "USSSA 9U–12U (default)";

/** Human-readable rules copy for UI — mirrors `computeAvailability` in ledger-aggregate. */
export function formatPitchingRulesBlurb(
  rules?: PitchingRulesConfig | null
): {
  profileLabel: string;
  intro: string;
  bullets: string[];
} {
  const r = normalizeRules(rules);
  const dailyMax = r.max_innings_per_day ?? 6;
  const restTrigger = r.innings_trigger_rest_day ?? 3;
  const restDays = r.rest_days_after_heavy_day ?? 1;
  const tournamentCap = r.tournament_innings_cap ?? 8;
  const rollingMax = r.max_innings_rolling_window ?? 8;
  const rollingDays = r.rolling_window_days ?? 3;

  return {
    profileLabel: DEFAULT_RULES_PROFILE_LABEL,
    intro:
      "Availability is evaluated for tomorrow using your local calendar date. Workload is drawn from games in the last 3 days (today plus the 2 prior days) when no tournament name is set — covering Fri–Sun and Sat–Sun weekends. Tag game dates on uploads so rest rules apply correctly.",
    bullets: [
      `Max ${dailyMax} innings per calendar day — at the daily max, pitcher is Unavailable the next day.`,
      `More than ${restTrigger} innings the day before a game → Unavailable (${restDays}-day rest rule).`,
      `${restTrigger}+ innings the day before → Limited the next day.`,
      `Tournament cap: ${tournamentCap} innings in the current workload window — drives Remaining and Emergency Only status.`,
      `Rolling limit: ${rollingMax} innings in ${rollingDays} days ending the day before the game.`,
      `Tournament name is optional — when every game in the window shares one name, workload is scoped to that tournament automatically.`,
    ],
  };
}
