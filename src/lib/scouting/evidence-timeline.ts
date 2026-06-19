import { formatDate } from "@/lib/utils";
import type {
  OpponentDetail,
  OpponentDocument,
  OpponentGameContext,
  OpponentNote,
  OpponentVoiceNote,
  ScreenshotUpload,
} from "@/types";

export type EvidenceKind =
  | "screenshot"
  | "note"
  | "voice"
  | "document"
  | "game_context";

export interface EvidenceLibraryItem {
  id: string;
  kind: EvidenceKind;
  title: string;
  subtitle?: string;
  preview?: string;
  date: string;
  gameType?: string;
  tournamentName?: string;
  opponentPlayed?: string;
  includedInReport: boolean;
  screenshot?: ScreenshotUpload;
  note?: OpponentNote;
  voice?: OpponentVoiceNote;
  document?: OpponentDocument;
  gameContext?: OpponentGameContext;
}

export interface EvidenceTimelineGroup {
  key: string;
  heading: string;
  subtitle: string;
  items: EvidenceLibraryItem[];
}

const GAME_TYPE_LABELS: Record<string, string> = {
  pool_play: "Pool Play",
  bracket_play: "Bracket Play",
  championship: "Championship",
  friendly: "Friendly",
  scrimmage: "Scrimmage",
  unknown: "Game",
};

const SCREENSHOT_TYPE_LABELS: Record<string, string> = {
  batting_stats: "Batting Stats",
  pitching_stats: "Pitching Stats",
  box_score: "Box Score",
  game_summary: "Game Summary",
  schedule_results: "Schedule / Results",
  schedule: "Schedule / Results",
  bracket_tournament: "Bracket / Tournament",
  roster: "Roster",
  unknown: "Screenshot",
};

function gameTypeLabel(value?: string | null): string {
  if (!value || value === "unknown") return "";
  return GAME_TYPE_LABELS[value] ?? value.replace(/_/g, " ");
}

function sortKey(date: string | null | undefined, createdAt: string): string {
  return date ?? createdAt.slice(0, 10);
}

function groupSubtitle(
  gameType?: string | null,
  opponentPlayed?: string | null,
  tournamentName?: string | null
): string {
  const parts: string[] = [];
  const typeLabel = gameTypeLabel(gameType);
  if (typeLabel) parts.push(typeLabel);
  if (opponentPlayed) parts.push(`vs ${opponentPlayed}`);
  else if (tournamentName) parts.push(tournamentName);
  return parts.join(" · ") || "General scouting";
}

export function buildEvidenceLibrary(data: OpponentDetail): EvidenceLibraryItem[] {
  const items: EvidenceLibraryItem[] = [];

  for (const upload of data.screenshot_uploads ?? []) {
    const type = upload.screenshot_type ?? "unknown";
    items.push({
      id: upload.id,
      kind: "screenshot",
      title: SCREENSHOT_TYPE_LABELS[type] ?? "Screenshot",
      subtitle: upload.game_date ? formatDate(upload.game_date) : formatDate(upload.created_at),
      date: sortKey(upload.game_date, upload.created_at),
      gameType: upload.game_type ?? undefined,
      tournamentName: upload.tournament_name ?? undefined,
      opponentPlayed: upload.opponent_played ?? undefined,
      includedInReport: upload.included_in_report !== false,
      screenshot: upload,
    });
  }

  for (const note of data.opponent_notes ?? []) {
    items.push({
      id: note.id,
      kind: "note",
      title: "Coach Note",
      preview: note.note_text,
      subtitle: formatDate(note.game_date ?? note.created_at),
      date: sortKey(note.game_date, note.created_at),
      gameType: note.game_type,
      opponentPlayed: note.opponent_played ?? undefined,
      includedInReport: note.included_in_report,
      note,
    });
  }

  for (const voice of data.opponent_voice_notes ?? []) {
    items.push({
      id: voice.id,
      kind: "voice",
      title: "Voice Note",
      preview: voice.transcript_text ?? undefined,
      subtitle: formatDate(voice.game_date ?? voice.created_at),
      date: sortKey(voice.game_date, voice.created_at),
      gameType: voice.game_type,
      opponentPlayed: voice.opponent_played ?? undefined,
      includedInReport: voice.included_in_report,
      voice,
    });
  }

  for (const doc of data.opponent_documents ?? []) {
    items.push({
      id: doc.id,
      kind: "document",
      title: doc.file_name,
      preview: doc.extracted_text ?? undefined,
      subtitle: formatDate(doc.created_at),
      date: doc.created_at.slice(0, 10),
      includedInReport: doc.included_in_report,
      document: doc,
    });
  }

  for (const ctx of data.opponent_game_context ?? []) {
    items.push({
      id: ctx.id,
      kind: "game_context",
      title: "Game Context",
      preview: ctx.notes ?? undefined,
      subtitle: formatDate(ctx.game_date ?? ctx.created_at),
      date: sortKey(ctx.game_date, ctx.created_at),
      gameType: ctx.game_type,
      tournamentName: ctx.tournament_name ?? undefined,
      opponentPlayed: ctx.opponent_played ?? undefined,
      includedInReport: ctx.included_in_report,
      gameContext: ctx,
    });
  }

  return items.sort((a, b) => b.date.localeCompare(a.date));
}

export function buildEvidenceTimeline(
  data: OpponentDetail
): EvidenceTimelineGroup[] {
  const library = buildEvidenceLibrary(data);
  const groups = new Map<string, EvidenceTimelineGroup>();

  for (const item of library) {
    const key = [
      item.date,
      item.gameType ?? "unknown",
      item.opponentPlayed ?? item.tournamentName ?? "general",
    ].join("|");

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        heading: item.date ? formatDate(item.date) : "Undated",
        subtitle: groupSubtitle(
          item.gameType,
          item.opponentPlayed,
          item.tournamentName
        ),
        items: [],
      });
    }
    groups.get(key)!.items.push(item);
  }

  return Array.from(groups.values()).sort((a, b) =>
    b.heading.localeCompare(a.heading)
  );
}

export function evidenceSourceCount(data: OpponentDetail): number {
  return (
    (data.screenshot_uploads?.length ?? 0) +
    (data.opponent_notes?.length ?? 0) +
    (data.opponent_voice_notes?.length ?? 0) +
    (data.opponent_documents?.length ?? 0) +
    (data.opponent_game_context?.length ?? 0)
  );
}
