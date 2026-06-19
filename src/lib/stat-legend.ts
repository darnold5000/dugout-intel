export interface StatLegendTerm {
  abbr: string;
  meaning: string;
}

export const BATTING_STAT_TERMS: StatLegendTerm[] = [
  { abbr: "AVG", meaning: "Batting average" },
  { abbr: "OBP", meaning: "On-base percentage" },
  { abbr: "OPS", meaning: "On-base plus slugging" },
  { abbr: "H", meaning: "Hits" },
  { abbr: "RBI", meaning: "Runs batted in" },
  { abbr: "R", meaning: "Runs scored" },
  { abbr: "BB", meaning: "Walks" },
  { abbr: "SO", meaning: "Strikeouts" },
  { abbr: "SB", meaning: "Stolen bases" },
];

export const PITCHING_STAT_TERMS: StatLegendTerm[] = [
  { abbr: "IP", meaning: "Innings pitched" },
  { abbr: "P", meaning: "Total pitches" },
  { abbr: "P-S", meaning: "Pitches–strikes" },
  { abbr: "BF", meaning: "Batters faced" },
  { abbr: "B", meaning: "Balls" },
  { abbr: "S%", meaning: "Strike percentage" },
  { abbr: "FPS%", meaning: "First-pitch strike percentage" },
  { abbr: "ERA", meaning: "Earned run average" },
  { abbr: "WHIP", meaning: "Walks plus hits per inning pitched" },
  { abbr: "K", meaning: "Strikeouts" },
  { abbr: "BB", meaning: "Walks" },
  { abbr: "K/BB", meaning: "Strikeout-to-walk ratio" },
  { abbr: "BB/INN", meaning: "Walks per inning" },
  { abbr: "P/IP", meaning: "Pitches per inning" },
  { abbr: "P/BF", meaning: "Pitches per batter faced" },
  { abbr: "BAA", meaning: "Batting average against" },
  { abbr: "SM%", meaning: "Swing-and-miss percentage" },
  { abbr: "123INN", meaning: "1-2-3 innings" },
  { abbr: "LOO", meaning: "Leadoff outs" },
  { abbr: "BABIP", meaning: "Batting average on balls in play" },
  { abbr: "FIP", meaning: "Fielding independent pitching" },
];

export function pickLegendTerms(
  allTerms: StatLegendTerm[],
  visibleAbbrs: string[]
): StatLegendTerm[] {
  const wanted = new Set(visibleAbbrs.map((a) => a.toUpperCase()));
  return allTerms.filter((term) => wanted.has(term.abbr.toUpperCase()));
}
