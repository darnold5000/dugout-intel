import { formatDate } from "@/lib/utils";
import type {
  ExtractedGame,
  OpponentDetail,
  OpponentGameContext,
} from "@/types";

export interface GameScoreInfo {
  result: string | null;
  runsFor: number | null;
  runsAgainst: number | null;
  source: "extracted" | "context" | "merged";
  extractedGameId?: string;
}

export interface RecentGameRow {
  id: string;
  gameDate: string | null;
  opponentName: string | null;
  result: string | null;
  runsFor: number | null;
  runsAgainst: number | null;
  scoreLine: string;
  gameType?: string | null;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeDate(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

/** Match key used by consolidate-stats game merge */
export function gameMatchKey(
  gameDate: string | null | undefined,
  opponentName: string | null | undefined
): string | null {
  const date = normalizeDate(gameDate);
  const opponent = normalizeText(opponentName);
  if (!date && !opponent) return null;
  return `${date}|${opponent}`;
}

export function findMatchingExtractedGame(
  games: ExtractedGame[],
  gameDate: string | null | undefined,
  opponentName: string | null | undefined
): ExtractedGame | null {
  const key = gameMatchKey(gameDate, opponentName);
  if (!key) return null;

  for (const game of games) {
    const gameKey = gameMatchKey(game.game_date, game.opponent_name);
    if (gameKey === key) return game;
    // Fuzzy: opponent contained in either direction
    if (
      normalizeDate(gameDate) === normalizeDate(game.game_date) &&
      normalizeText(opponentName) &&
      normalizeText(game.opponent_name) &&
      (normalizeText(game.opponent_name).includes(normalizeText(opponentName)) ||
        normalizeText(opponentName).includes(normalizeText(game.opponent_name)))
    ) {
      return game;
    }
  }
  return null;
}

export function scoreFromExtractedGame(game: ExtractedGame): GameScoreInfo {
  return {
    result: game.result,
    runsFor: game.runs_for,
    runsAgainst: game.runs_against,
    source: "extracted",
    extractedGameId: game.id,
  };
}

export function scoreFromGameContext(ctx: OpponentGameContext): GameScoreInfo | null {
  if (
    ctx.result == null &&
    ctx.runs_for == null &&
    ctx.runs_against == null
  ) {
    return null;
  }
  return {
    result: ctx.result ?? null,
    runsFor: ctx.runs_for ?? null,
    runsAgainst: ctx.runs_against ?? null,
    source: "context",
  };
}

export function resolveGameScore(
  data: OpponentDetail,
  gameDate: string | null | undefined,
  opponentName: string | null | undefined,
  context?: OpponentGameContext | null
): GameScoreInfo | null {
  const manual = context ? scoreFromGameContext(context) : null;
  const extracted = findMatchingExtractedGame(
    data.extracted_games ?? [],
    gameDate,
    opponentName
  );
  const fromExtracted = extracted ? scoreFromExtractedGame(extracted) : null;

  if (manual && fromExtracted) {
    return {
      result: manual.result ?? fromExtracted.result,
      runsFor: manual.runsFor ?? fromExtracted.runsFor,
      runsAgainst: manual.runsAgainst ?? fromExtracted.runsAgainst,
      source: "merged",
      extractedGameId: fromExtracted.extractedGameId,
    };
  }
  return manual ?? fromExtracted;
}

export function formatGameScoreLine(score: GameScoreInfo | null): string | null {
  if (!score) return null;
  const parts: string[] = [];
  if (score.result) parts.push(score.result.toUpperCase());
  if (score.runsFor != null && score.runsAgainst != null) {
    parts.push(`${score.runsFor}-${score.runsAgainst}`);
  }
  return parts.length ? parts.join(" ") : null;
}

export function formatRecentGameRow(game: ExtractedGame): RecentGameRow {
  const score = scoreFromExtractedGame(game);
  return {
    id: game.id,
    gameDate: game.game_date,
    opponentName: game.opponent_name,
    result: game.result,
    runsFor: game.runs_for,
    runsAgainst: game.runs_against,
    scoreLine:
      formatGameScoreLine(score) ??
      (game.result ?? "—"),
  };
}

export function buildRecentGames(data: OpponentDetail, limit = 8): RecentGameRow[] {
  const games = [...(data.extracted_games ?? [])].sort((a, b) => {
    const da = a.game_date ?? a.created_at;
    const db = b.game_date ?? b.created_at;
    return db.localeCompare(da);
  });
  return games.slice(0, limit).map(formatRecentGameRow);
}

export function buildGameResultsSummary(data: OpponentDetail): string[] {
  const rows = buildRecentGames(data, 12);
  if (!rows.length) return [];
  return rows.map((g) => {
    const date = g.gameDate ? formatDate(g.gameDate) : "Unknown date";
    const opp = g.opponentName ? `vs ${g.opponentName}` : "";
    return `${date} ${opp}: ${g.scoreLine}`.trim();
  });
}

export interface TimelineGroupScore {
  scoreLine: string | null;
  result: string | null;
}

export function resolveTimelineGroupScore(
  data: OpponentDetail,
  gameDate: string | null | undefined,
  opponentPlayed: string | null | undefined,
  gameContexts: OpponentGameContext[] = []
): TimelineGroupScore {
  const matchingContext = gameContexts.find(
    (c) =>
      gameMatchKey(c.game_date, c.opponent_played) ===
      gameMatchKey(gameDate, opponentPlayed)
  );
  const score = resolveGameScore(
    data,
    gameDate,
    opponentPlayed,
    matchingContext
  );
  const scoreLine = formatGameScoreLine(score);
  return {
    scoreLine,
    result: score?.result ?? null,
  };
}

/** First game row from extraction — for auto-tagging screenshots */
export function primaryGameFromExtraction(games: {
  game_date: string | null;
  opponent_name: string | null;
}[]): { game_date: string | null; opponent_played: string | null } | null {
  const first = games.find((g) => g.game_date || g.opponent_name);
  if (!first) return null;
  return {
    game_date: first.game_date?.slice(0, 10) ?? null,
    opponent_played: first.opponent_name,
  };
}
