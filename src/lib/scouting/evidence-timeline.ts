import { formatDate } from "@/lib/utils";
import {
  formatGameScoreLine,
  resolveGameScore,
  resolveTimelineGroupScore,
} from "@/lib/scouting/game-results";
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
  importance: number;
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
  scoreLine: string | null;
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

function screenshotImportance(type: string | null | undefined): number {
  if (type === "pitching_stats" || type === "box_score") return 4;
  if (type === "batting_stats" || type === "game_summary") return 4;
  if (type === "schedule_results" || type === "schedule") return 4;
  if (type === "bracket_tournament") return 3;
  if (type === "unknown") return 1;
  return 3;
}

function noteTypeImportance(noteType?: string | null): number | null {
  if (noteType === "gamechanger_recap") return 5;
  return null;
}

function gameTypeImportance(gameType?: string | null): number {
  if (gameType === "championship") return 5;
  if (gameType === "bracket_play") return 5;
  if (gameType === "pool_play") return 2;
  return 3;
}

function kindImportance(
  kind: EvidenceKind,
  gameType?: string | null,
  screenshotType?: string | null,
  noteType?: string | null
): number {
  const noteBoost = noteTypeImportance(noteType);
  if (kind === "screenshot") return screenshotImportance(screenshotType);
  if (kind === "game_context") return gameTypeImportance(gameType);
  if (kind === "note" || kind === "voice") {
    if (noteBoost != null) return noteBoost;
    const base = gameTypeImportance(gameType);
    if (gameType === "pool_play") return 2;
    if (kind === "voice") return Math.min(5, base + 1);
    return base;
  }
  if (kind === "document") return 3;
  return 2;
}

export function getScoutNoteWeight(
  kind: EvidenceKind,
  gameType?: string | null,
  screenshotType?: string | null,
  noteType?: string | null
): number {
  return kindImportance(kind, gameType, screenshotType, noteType);
}

export function importanceStars(importance: number): string {
  return "⭐".repeat(Math.max(1, Math.min(5, importance)));
}

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
    const scoreLine = formatGameScoreLine(
      resolveGameScore(data, upload.game_date, upload.opponent_played)
    );
    items.push({
      id: upload.id,
      kind: "screenshot",
      title: SCREENSHOT_TYPE_LABELS[type] ?? "Screenshot",
      subtitle: [
        upload.game_date ? formatDate(upload.game_date) : formatDate(upload.created_at),
        scoreLine,
      ]
        .filter(Boolean)
        .join(" · "),
      date: sortKey(upload.game_date, upload.created_at),
      gameType: upload.game_type ?? undefined,
      tournamentName: upload.tournament_name ?? undefined,
      opponentPlayed: upload.opponent_played ?? undefined,
      includedInReport: upload.included_in_report !== false,
      importance: kindImportance("screenshot", upload.game_type, type),
      screenshot: upload,
    });
  }

  for (const note of data.opponent_notes ?? []) {
    const scoreLine = formatGameScoreLine(
      resolveGameScore(data, note.game_date, note.opponent_played)
    );
    items.push({
      id: note.id,
      kind: "note",
      title: "Coach Note",
      preview: note.note_text,
      subtitle: [formatDate(note.game_date ?? note.created_at), scoreLine]
        .filter(Boolean)
        .join(" · "),
      date: sortKey(note.game_date, note.created_at),
      gameType: note.game_type,
      opponentPlayed: note.opponent_played ?? undefined,
      includedInReport: note.included_in_report,
      importance: kindImportance("note", note.game_type, undefined, note.note_type),
      note,
    });
  }

  for (const voice of data.opponent_voice_notes ?? []) {
    const scoreLine = formatGameScoreLine(
      resolveGameScore(data, voice.game_date, voice.opponent_played)
    );
    items.push({
      id: voice.id,
      kind: "voice",
      title: "Voice Note",
      preview: voice.transcript_text ?? undefined,
      subtitle: [formatDate(voice.game_date ?? voice.created_at), scoreLine]
        .filter(Boolean)
        .join(" · "),
      date: sortKey(voice.game_date, voice.created_at),
      gameType: voice.game_type,
      opponentPlayed: voice.opponent_played ?? undefined,
      includedInReport: voice.included_in_report,
      importance: kindImportance("voice", voice.game_type, undefined, voice.note_type),
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
      importance: kindImportance("document"),
      document: doc,
    });
  }

  for (const ctx of data.opponent_game_context ?? []) {
    const score = resolveGameScore(data, ctx.game_date, ctx.opponent_played, ctx);
    const scoreLine = formatGameScoreLine(score);
    items.push({
      id: ctx.id,
      kind: "game_context",
      title: "Game Context",
      preview: ctx.notes ?? undefined,
      subtitle: [formatDate(ctx.game_date ?? ctx.created_at), scoreLine]
        .filter(Boolean)
        .join(" · "),
      date: sortKey(ctx.game_date, ctx.created_at),
      gameType: ctx.game_type,
      tournamentName: ctx.tournament_name ?? undefined,
      opponentPlayed: ctx.opponent_played ?? undefined,
      includedInReport: ctx.included_in_report,
      importance: kindImportance("game_context", ctx.game_type),
      gameContext: ctx,
    });
  }

  return items.sort((a, b) => b.date.localeCompare(a.date));
}

export interface EvidenceTimelineSummary {
  kind: EvidenceKind;
  label: string;
  count: number;
  importance: number;
}

/** Collapse duplicate timeline rows (e.g. 10 box scores → one chip). */
export function summarizeTimelineItems(
  items: EvidenceLibraryItem[]
): EvidenceTimelineSummary[] {
  const buckets = new Map<string, EvidenceTimelineSummary>();

  for (const item of items) {
    const bucketKey = `${item.kind}|${item.title}`;
    const existing = buckets.get(bucketKey);
    if (existing) {
      existing.count += 1;
      existing.importance = Math.max(existing.importance, item.importance);
    } else {
      buckets.set(bucketKey, {
        kind: item.kind,
        label: item.title,
        count: 1,
        importance: item.importance,
      });
    }
  }

  const kindOrder: EvidenceKind[] = [
    "screenshot",
    "game_context",
    "note",
    "voice",
    "document",
  ];

  return Array.from(buckets.values()).sort(
    (a, b) => kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind)
  );
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
      const { scoreLine } = resolveTimelineGroupScore(
        data,
        item.date,
        item.opponentPlayed ?? null,
        data.opponent_game_context ?? []
      );
      groups.set(key, {
        key,
        heading: item.date ? formatDate(item.date) : "Undated",
        subtitle: groupSubtitle(
          item.gameType,
          item.opponentPlayed,
          item.tournamentName
        ),
        scoreLine,
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

export const scoutNotesCount = evidenceSourceCount;
