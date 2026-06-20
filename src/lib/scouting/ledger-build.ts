import { parsePlayerIdentity } from "@/lib/extraction/player-identity";
import { gameMatchKey } from "@/lib/scouting/game-results";
import type { LedgerEntryDraft } from "@/lib/scouting/ledger-types";
import { extractPitchingFromRecap } from "@/lib/scouting/recap-pitching-extraction";
import { enrichPitchingStatForDisplay } from "@/lib/scouting/pitching-derived";
import { extractionFromRawTable } from "@/lib/extraction/consolidate-stats";
import type {
  LedgerSourceType,
  OpponentDetail,
  OpponentGameContext,
  OpponentNote,
  OpponentVoiceNote,
  PitchingLedgerEntry,
  ScreenshotUpload,
} from "@/types";
import type { AIExtractionResult } from "@/types";

function ledgerAppearanceKey(entry: {
  jersey_number?: string | null;
  player_name?: string | null;
  game_date?: string | null;
  opponent_played?: string | null;
}): string | null {
  const identity = parsePlayerIdentity(
    entry.player_name,
    entry.jersey_number ?? null
  );
  const gameKey = gameMatchKey(entry.game_date, entry.opponent_played);
  const playerKey =
    identity.jersey_number ??
    identity.merge_key ??
    identity.player_name?.toLowerCase() ??
    null;
  if (!playerKey || !gameKey) return null;
  return `${playerKey}|${gameKey}`;
}

function pickBetter<T>(a: T | null | undefined, b: T | null | undefined): T | null {
  if (a != null && b != null) return a;
  return a ?? b ?? null;
}

function mergeDrafts(
  existing: LedgerEntryDraft,
  incoming: LedgerEntryDraft
): LedgerEntryDraft {
  return {
    player_name: existing.player_name ?? incoming.player_name,
    jersey_number: existing.jersey_number ?? incoming.jersey_number,
    game_date: existing.game_date ?? incoming.game_date,
    opponent_played: existing.opponent_played ?? incoming.opponent_played,
    game_type:
      existing.game_type !== "unknown" ? existing.game_type : incoming.game_type,
    tournament_name: existing.tournament_name ?? incoming.tournament_name,
    innings_pitched: pickBetter(existing.innings_pitched, incoming.innings_pitched),
    pitch_count: pickBetter(existing.pitch_count, incoming.pitch_count),
    batters_faced: pickBetter(existing.batters_faced, incoming.batters_faced),
    strikeouts: pickBetter(existing.strikeouts, incoming.strikeouts),
    walks: pickBetter(existing.walks, incoming.walks),
    hits_allowed: pickBetter(existing.hits_allowed, incoming.hits_allowed),
    started_game: existing.started_game ?? incoming.started_game,
    finished_game: existing.finished_game ?? incoming.finished_game,
    entered_inning: existing.entered_inning ?? incoming.entered_inning,
    score_when_entered:
      existing.score_when_entered ?? incoming.score_when_entered,
    leverage:
      existing.leverage !== "medium" ? existing.leverage : incoming.leverage,
    source_type: existing.source_type,
    source_reference: `${existing.source_reference ?? ""},${incoming.source_reference ?? ""}`
      .replace(/^,|,$/g, "")
      .slice(0, 500),
  };
}

function classifyScreenshotSource(type: string | null): LedgerSourceType {
  if (type === "box_score") return "box_score";
  if (type === "pitching_stats") return "pitching_stats";
  return "screenshot";
}

function entriesFromUpload(
  upload: ScreenshotUpload,
  extraction: AIExtractionResult
): LedgerEntryDraft[] {
  const gameDate = upload.game_date?.slice(0, 10) ?? null;
  const opponentPlayed = upload.opponent_played ?? null;
  const gameType = upload.game_type ?? "unknown";
  const tournamentName = upload.tournament_name ?? null;
  const sourceType = classifyScreenshotSource(upload.screenshot_type);

  if (!extraction.pitching_stats.length) return [];

  return extraction.pitching_stats.map((row) => {
    const enriched = enrichPitchingStatForDisplay(row);
    const pitches = enriched.total_pitches ?? enriched.pitches;
    return {
      player_name: enriched.player_name,
      jersey_number: enriched.jersey_number,
      game_date: gameDate,
      opponent_played: opponentPlayed,
      game_type: gameType,
      tournament_name: tournamentName,
      innings_pitched: enriched.innings_pitched,
      pitch_count: pitches,
      batters_faced: enriched.batters_faced,
      strikeouts: enriched.strikeouts,
      walks: enriched.walks,
      hits_allowed: enriched.hits_allowed,
      started_game: null,
      finished_game: null,
      entered_inning: null,
      score_when_entered: null,
      leverage: "medium",
      source_type: sourceType,
      source_reference: upload.id,
    };
  });
}

function entriesFromGameContext(ctx: OpponentGameContext): LedgerEntryDraft[] {
  if (!ctx.notes?.trim()) return [];
  return extractPitchingFromRecap(ctx.notes, {
    game_date: ctx.game_date,
    opponent_played: ctx.opponent_played,
    game_type: ctx.game_type,
    tournament_name: ctx.tournament_name,
    leverage: ctx.leverage,
    entered_inning: ctx.inning_observed,
    score_when_entered: ctx.score_when_pitcher_entered,
    source_reference: ctx.id,
    source_type: "game_context",
  });
}

function entriesFromNote(note: OpponentNote): LedgerEntryDraft[] {
  if (!note.note_text?.trim()) return [];
  return extractPitchingFromRecap(note.note_text, {
    game_date: note.game_date,
    opponent_played: note.opponent_played,
    game_type: note.game_type,
    tournament_name: null,
    leverage: "medium",
    source_reference: note.id,
    source_type: note.note_type === "gamechanger_recap" ? "recap" : "scout_note",
  });
}

function entriesFromVoice(voice: OpponentVoiceNote): LedgerEntryDraft[] {
  if (!voice.transcript_text?.trim()) return [];
  return extractPitchingFromRecap(voice.transcript_text, {
    game_date: voice.game_date,
    opponent_played: voice.opponent_played,
    game_type: voice.game_type,
    tournament_name: null,
    leverage: "medium",
    source_reference: voice.id,
    source_type: "voice_note",
  });
}

function entriesFromDocument(
  doc: { id: string; extracted_text: string | null }
): LedgerEntryDraft[] {
  if (!doc.extracted_text?.trim()) return [];
  return extractPitchingFromRecap(doc.extracted_text, {
    game_date: null,
    opponent_played: null,
    game_type: "unknown",
    tournament_name: null,
    leverage: "medium",
    source_reference: doc.id,
    source_type: "document",
  });
}

export function buildLedgerDrafts(data: OpponentDetail): LedgerEntryDraft[] {
  const byKey = new Map<string, LedgerEntryDraft>();

  const add = (draft: LedgerEntryDraft) => {
    const key = ledgerAppearanceKey(draft);
    if (!key) return;
    const existing = byKey.get(key);
    byKey.set(key, existing ? mergeDrafts(existing, draft) : draft);
  };

  for (const upload of data.screenshot_uploads ?? []) {
    if (!upload.raw_extracted_table) continue;
    const extraction = extractionFromRawTable(
      upload.raw_extracted_table,
      upload.screenshot_type
    );
    for (const draft of entriesFromUpload(upload, extraction)) {
      add(draft);
    }
  }

  for (const ctx of data.opponent_game_context ?? []) {
    for (const draft of entriesFromGameContext(ctx)) add(draft);
  }

  for (const note of data.opponent_notes ?? []) {
    for (const draft of entriesFromNote(note)) add(draft);
  }

  for (const voice of data.opponent_voice_notes ?? []) {
    for (const draft of entriesFromVoice(voice)) add(draft);
  }

  for (const doc of data.opponent_documents ?? []) {
    for (const draft of entriesFromDocument(doc)) add(draft);
  }

  return Array.from(byKey.values()).sort((a, b) => {
    const da = a.game_date ?? "";
    const db = b.game_date ?? "";
    return da.localeCompare(db);
  });
}

export function playerLedgerKey(entry: {
  player_name?: string | null;
  jersey_number?: string | null;
}): string {
  const identity = parsePlayerIdentity(
    entry.player_name ?? null,
    entry.jersey_number ?? null
  );
  return (
    identity.jersey_number ??
    identity.merge_key ??
    identity.player_name?.toLowerCase() ??
    "unknown"
  );
}

export function formatPitcherLabel(entry: {
  player_name?: string | null;
  jersey_number?: string | null;
}): string {
  const name = entry.player_name ?? "Unknown";
  return entry.jersey_number ? `#${entry.jersey_number} ${name}` : name;
}

export function ledgerEntryToDraft(entry: PitchingLedgerEntry): LedgerEntryDraft {
  return {
    player_name: entry.player_name,
    jersey_number: entry.jersey_number,
    game_date: entry.game_date,
    opponent_played: entry.opponent_played,
    game_type: entry.game_type,
    tournament_name: entry.tournament_name,
    innings_pitched: entry.innings_pitched,
    pitch_count: entry.pitch_count,
    batters_faced: entry.batters_faced,
    strikeouts: entry.strikeouts,
    walks: entry.walks,
    hits_allowed: entry.hits_allowed,
    started_game: entry.started_game,
    finished_game: entry.finished_game,
    entered_inning: entry.entered_inning,
    score_when_entered: entry.score_when_entered,
    leverage: entry.leverage,
    source_type: entry.source_type,
    source_reference: entry.source_reference,
  };
}
