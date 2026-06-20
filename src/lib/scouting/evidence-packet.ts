import {
  analyzePitchingStaffFromDetail,
  formatPitchingStaffRead,
  type PitcherAnalysis,
} from "@/lib/scouting/pitching-analysis";
import {
  buildPitcherSummaries,
  buildPitchingLedgerOutlook,
  formatTournamentPitchingIntelligence,
} from "@/lib/scouting/ledger-aggregate";
import { resolveLedgerEntries } from "@/lib/scouting/resolve-ledger";
import { getScoutNoteWeight } from "@/lib/scouting/evidence-timeline";
import { buildGameResultsSummary } from "@/lib/scouting/game-results";
import type { OpponentDetail } from "@/types";

export interface EvidencePacket {
  screenshots: {
    id: string;
    type: string | null;
    extraction_status: string;
    raw_extracted_table: unknown;
    game_date: string | null;
    game_type: string | null;
    opponent_played: string | null;
    tournament_name: string | null;
    weight: number;
  }[];
  notes: {
    id: string;
    note_text: string;
    note_type: string;
    importance: string;
    game_date: string | null;
    game_type: string | null;
    opponent_played: string | null;
    weight: number;
  }[];
  voiceNotes: {
    id: string;
    transcript_text: string | null;
    note_type: string;
    game_type: string | null;
    game_date: string | null;
    opponent_played: string | null;
    weight: number;
  }[];
  documents: {
    id: string;
    file_name: string;
    file_type: string | null;
    extracted_text: string | null;
    weight: number;
  }[];
  gameContexts: {
    id: string;
    game_date: string | null;
    opponent_played: string | null;
    tournament_name: string | null;
    game_type: string;
    inning_observed: string | null;
    score_when_pitcher_entered: string | null;
    reason_pitcher_entered: string | null;
    leverage: string | null;
    notes: string | null;
    result: string | null;
    runs_for: number | null;
    runs_against: number | null;
    weight: number;
  }[];
  gameResultsSummary: string[];
  consolidatedStats: {
    players: unknown[];
    battingStats: unknown[];
    pitchingStats: unknown[];
    games: unknown[];
  };
  pitchingAnalysis: PitcherAnalysis[];
  pitchingStaffRead: string;
  tournamentPitchingRead: string;
  evidenceCounts: {
    screenshots: number;
    notes: number;
    voiceNotes: number;
    documents: number;
    gameContexts: number;
  };
}

export function buildEvidencePacket(data: OpponentDetail): EvidencePacket {
  const screenshots = (data.screenshot_uploads ?? [])
    .filter((s) => s.included_in_report !== false)
    .map((s) => ({
      id: s.id,
      type: s.screenshot_type,
      extraction_status: s.extraction_status,
      raw_extracted_table: s.raw_extracted_table,
      game_date: s.game_date ?? null,
      game_type: s.game_type ?? null,
      opponent_played: s.opponent_played ?? null,
      tournament_name: s.tournament_name ?? null,
      weight: getScoutNoteWeight("screenshot", s.game_type, s.screenshot_type),
    }));

  const notes = (data.opponent_notes ?? [])
    .filter((n) => n.included_in_report !== false)
    .map((n) => ({
      id: n.id,
      note_text: n.note_text,
      note_type: n.note_type,
      importance: n.importance,
      game_date: n.game_date,
      game_type: n.game_type,
      opponent_played: n.opponent_played ?? null,
      weight: getScoutNoteWeight("note", n.game_type, undefined, n.note_type),
    }));

  const voiceNotes = (data.opponent_voice_notes ?? [])
    .filter((v) => v.included_in_report !== false)
    .map((v) => ({
      id: v.id,
      transcript_text: v.transcript_text,
      note_type: v.note_type,
      game_type: v.game_type,
      game_date: v.game_date ?? null,
      opponent_played: v.opponent_played ?? null,
      weight: getScoutNoteWeight("voice", v.game_type, undefined, v.note_type),
    }));

  const documents = (data.opponent_documents ?? [])
    .filter((d) => d.included_in_report !== false)
    .map((d) => ({
      id: d.id,
      file_name: d.file_name,
      file_type: d.file_type,
      extracted_text: d.extracted_text,
      weight: getScoutNoteWeight("document"),
    }));

  const gameContexts = (data.opponent_game_context ?? [])
    .filter((g) => g.included_in_report !== false)
    .map((g) => ({
      id: g.id,
      game_date: g.game_date,
      opponent_played: g.opponent_played,
      tournament_name: g.tournament_name,
      game_type: g.game_type,
      inning_observed: g.inning_observed,
      score_when_pitcher_entered: g.score_when_pitcher_entered,
      reason_pitcher_entered: g.reason_pitcher_entered,
      leverage: g.leverage,
      notes: g.notes,
      result: g.result ?? null,
      runs_for: g.runs_for ?? null,
      runs_against: g.runs_against ?? null,
      pitcher_jersey_number: g.pitcher_jersey_number ?? null,
      pitcher_name: g.pitcher_name ?? null,
      innings_pitched: g.innings_pitched ?? null,
      pitch_count: g.pitch_count ?? null,
      pitcher_role: g.pitcher_role ?? "unknown",
      weight: getScoutNoteWeight("game_context", g.game_type),
    }));

  const gameResultsSummary = buildGameResultsSummary(data);

  const pitchingAnalysis = analyzePitchingStaffFromDetail(data);
  const ledgerEntries = resolveLedgerEntries(data);
  const ledgerSummaries = buildPitcherSummaries(ledgerEntries);
  const ledgerOutlook = buildPitchingLedgerOutlook(ledgerSummaries);

  return {
    screenshots,
    notes,
    voiceNotes,
    documents,
    gameContexts,
    gameResultsSummary,
    consolidatedStats: {
      players: data.extracted_players ?? [],
      battingStats: data.extracted_batting_stats ?? [],
      pitchingStats: data.extracted_pitching_stats ?? [],
      games: data.extracted_games ?? [],
    },
    pitchingAnalysis,
    pitchingStaffRead: formatPitchingStaffRead(pitchingAnalysis),
    tournamentPitchingRead: formatTournamentPitchingIntelligence(
      ledgerSummaries,
      ledgerOutlook
    ),
    evidenceCounts: {
      screenshots: screenshots.length,
      notes: notes.length,
      voiceNotes: voiceNotes.length,
      documents: documents.length,
      gameContexts: gameContexts.length,
    },
  };
}

export function hasEvidenceForReport(packet: EvidencePacket): boolean {
  const hasConsolidated =
    packet.consolidatedStats.players.length > 0 ||
    packet.consolidatedStats.battingStats.length > 0 ||
    packet.consolidatedStats.pitchingStats.length > 0 ||
    packet.consolidatedStats.games.length > 0;

  const hasQualitative =
    packet.notes.length > 0 ||
    packet.voiceNotes.some((v) => v.transcript_text) ||
    packet.documents.some((d) => d.extracted_text) ||
    packet.gameContexts.length > 0;

  const hasScreenshots = packet.screenshots.length > 0;

  return hasConsolidated || hasQualitative || hasScreenshots;
}
