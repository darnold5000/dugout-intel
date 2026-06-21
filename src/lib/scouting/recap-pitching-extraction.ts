import { parsePlayerIdentity } from "@/lib/extraction/player-identity";
import type { Leverage } from "@/types";
import type { LedgerEntryDraft } from "@/lib/scouting/ledger-types";

interface RecapContext {
  game_date?: string | null;
  opponent_played?: string | null;
  game_type?: string | null;
  tournament_name?: string | null;
  leverage?: Leverage | string;
  entered_inning?: string | null;
  score_when_entered?: string | null;
  source_reference: string;
  source_type: LedgerEntryDraft["source_type"];
}

function inferGameType(text: string, fallback: string): string {
  const lower = text.toLowerCase();
  if (/championship|title game|finals/.test(lower)) return "championship";
  if (/semifinal|semi-final/.test(lower)) return "semifinal";
  if (/quarterfinal|quarter-final/.test(lower)) return "quarterfinal";
  if (/bracket|elimination|knockout/.test(lower)) return "bracket_play";
  if (/pool play|pool game/.test(lower)) return "pool_play";
  return fallback;
}

function inferLeverage(text: string, fallback: Leverage | string): Leverage | string {
  const lower = text.toLowerCase();
  if (/championship|semifinal|quarterfinal|elimination|tied|runners on|bases loaded|save situation|up 1|down 1/.test(lower)) {
    return /championship|bases loaded|save situation|up 1 run/.test(lower)
      ? "critical"
      : "high";
  }
  if (/reliev|entered|close game|late inning/.test(lower)) return "high";
  if (/blowout|down \d+-\d+|emergency/.test(lower)) return "low";
  return fallback;
}

function extractPitcherName(sentence: string): string | null {
  const patterns = [
    /([A-Z][a-z]+(?:\s+[A-Z][a-z.])?)\s+entered/i,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z.])?)\s+reliev/i,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z.])?)\s+started/i,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z.])?)\s+finished/i,
    /#(\d{1,3})\s+([A-Z][a-z]+(?:\s+[A-Z][a-z.])?)/,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z.])?)\s+#(\d{1,3})/,
  ];

  for (const pattern of patterns) {
    const match = sentence.match(pattern);
    if (!match) continue;
    if (match[2] && /^\d+$/.test(match[1])) {
      return `${match[2]} #${match[1]}`;
    }
    return match[1]?.trim() ?? null;
  }
  return null;
}

function extractInning(sentence: string): string | null {
  const match = sentence.match(
    /(\d{1,2})(?:st|nd|rd|th)?\s+inning|inning\s+(\d{1,2})|top of the (\d{1,2})|bottom of the (\d{1,2})/i
  );
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? match[4] ?? null;
}

function extractPitchCount(sentence: string): number | null {
  const match = sentence.match(/(\d{1,3})\s+pitches?/i);
  return match ? Number(match[1]) : null;
}

function extractInningsPitched(sentence: string): number | null {
  const match = sentence.match(/(\d(?:\.\d)?)\s+ip/i);
  return match ? Number(match[1]) : null;
}

export function extractPitchingFromRecap(
  text: string,
  ctx: RecapContext
): LedgerEntryDraft[] {
  const entries: LedgerEntryDraft[] = [];
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    if (
      !/pitch|reliev|entered|started|finished|struck out|walked|innings pitched|\d+\s+pitches?/i.test(
        lower
      )
    ) {
      continue;
    }

    const rawName = extractPitcherName(sentence);
    if (!rawName) continue;

    const identity = parsePlayerIdentity(rawName, null);
    const started = /started|opening pitch|toe the rubber/i.test(lower);
    const finished = /finished|closed out|got the save|final out/i.test(lower);
    const entered = /entered|reliev|came in/i.test(lower);

    entries.push({
      player_name: identity.player_name,
      jersey_number: identity.jersey_number,
      game_date: ctx.game_date?.slice(0, 10) ?? null,
      opponent_played: ctx.opponent_played ?? null,
      game_type: inferGameType(sentence, ctx.game_type ?? "unknown"),
      tournament_name: ctx.tournament_name ?? null,
      innings_pitched: extractInningsPitched(sentence),
      pitch_count: extractPitchCount(sentence),
      strikes: null,
      batters_faced: null,
      strikeouts: null,
      walks: null,
      hits_allowed: null,
      started_game: started ? true : entered ? false : null,
      finished_game: finished ? true : null,
      entered_inning: ctx.entered_inning ?? extractInning(sentence),
      score_when_entered: ctx.score_when_entered ?? null,
      leverage: inferLeverage(sentence, ctx.leverage ?? "medium"),
      source_type: ctx.source_type,
      source_reference: ctx.source_reference,
    });
  }

  return entries;
}
