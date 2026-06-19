"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScreenshotDetailModal } from "@/components/opponent/ScreenshotDetailModal";
import { ExtractionStatusBadge } from "@/components/ExtractionStatusBadge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { getAuthHeaders } from "@/lib/auth-headers";
import {
  buildEvidenceLibrary,
  buildEvidenceTimeline,
  importanceStars,
  type EvidenceKind,
  type EvidenceLibraryItem,
} from "@/lib/scouting/evidence-timeline";
import {
  buildRecentGames,
  findMatchingExtractedGame,
  formatGameScoreLine,
  resolveGameScore,
} from "@/lib/scouting/game-results";
import { RecentGamesSection } from "@/components/opponent/RecentGamesSection";
import { inferNoteTypeFromText } from "@/lib/scouting/recap-extraction";
import type {
  ExtractionResult,
  ExtractionSummary,
  OpponentDetail,
  ScreenshotType,
  ScreenshotUpload,
} from "@/types";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FileText,
  Maximize2,
  Mic,
  Paperclip,
  Sparkles,
  Trash2,
} from "lucide-react";

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

const GAME_TYPES = [
  { value: "unknown", label: "Unknown" },
  { value: "pool_play", label: "Pool Play" },
  { value: "bracket_play", label: "Bracket Play" },
  { value: "championship", label: "Championship" },
  { value: "friendly", label: "Friendly" },
  { value: "scrimmage", label: "Scrimmage" },
];

const KIND_ICONS: Record<EvidenceKind, string> = {
  screenshot: "📷",
  note: "📝",
  voice: "🎤",
  document: "📄",
  game_context: "⚾",
};

const KIND_LABELS: Record<EvidenceKind, string> = {
  screenshot: "Screenshot",
  note: "Coach Note",
  voice: "Voice Note",
  document: "Document",
  game_context: "Game Context",
};

interface EvidenceTabProps {
  opponentId: string;
  opponentName: string;
  data: OpponentDetail;
  onRefresh: () => Promise<void>;
}

function IncludedToggle({
  included,
  onChange,
}: {
  included: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs cursor-pointer">
      <input
        type="checkbox"
        checked={included}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded"
      />
      <span className={included ? "text-foreground" : "text-muted-foreground"}>
        Included ✓
      </span>
    </label>
  );
}

export function ScoutNotesTab({
  opponentId,
  opponentName,
  data,
  onRefresh,
}: EvidenceTabProps) {
  const [composerText, setComposerText] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [showContext, setShowContext] = useState(false);
  const [context, setContext] = useState({
    game_date: "",
    opponent_played: "",
    tournament_name: "",
    game_type: "unknown",
    leverage: "medium",
    inning_observed: "",
    notes: "",
    result: "",
    runs_for: "",
    runs_against: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");
  const [extractionSummary, setExtractionSummary] =
    useState<ExtractionSummary | null>(null);
  const [detailUpload, setDetailUpload] = useState<ScreenshotUpload | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScreenshotUpload | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);

  const library = useMemo(() => buildEvidenceLibrary(data), [data]);
  const timeline = useMemo(() => buildEvidenceTimeline(data), [data]);
  const screenshotItems = useMemo(
    () => library.filter((i) => i.kind === "screenshot" && i.screenshot),
    [library]
  );
  const recentGames = useMemo(() => buildRecentGames(data), [data]);

  const matchedExtractedGame = useMemo(() => {
    if (!context.game_date && !context.opponent_played) return null;
    return findMatchingExtractedGame(
      data.extracted_games ?? [],
      context.game_date || null,
      context.opponent_played || null
    );
  }, [data.extracted_games, context.game_date, context.opponent_played]);

  const matchedScoreLine = useMemo(() => {
    if (context.result || context.runs_for || context.runs_against) return null;
    if (!matchedExtractedGame) return null;
    return formatGameScoreLine(resolveGameScore(data, context.game_date, context.opponent_played));
  }, [context, data, matchedExtractedGame]);

  const pendingUploads = useMemo(
    () =>
      (data.screenshot_uploads ?? []).filter(
        (u) =>
          u.extraction_status === "pending" || u.extraction_status === "failed"
      ),
    [data.screenshot_uploads]
  );

  const addFiles = (files: FileList | File[]) => {
    setAttachedFiles((prev) => [...prev, ...Array.from(files)]);
  };

  const runExtraction = async (uploadIds?: string[]) => {
    setExtracting(true);
    setError("");
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`/api/opponents/${opponentId}/extract`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(uploadIds ? { upload_ids: uploadIds } : {}),
      });
      const data = await res.json();

      if (data.totals) {
        setExtractionSummary(data.totals);
      }

      if (!res.ok) {
        const failed = data.results?.find(
          (r: ExtractionResult) => r.status === "failed"
        );
        throw new Error(failed?.error || data.error || "Extraction failed");
      }

      const last = data.results?.[data.results.length - 1] as
        | ExtractionResult
        | undefined;
      if (last?.counts) {
        setExtractionSummary(last.counts);
      }

      const extractedCount =
        (last?.counts?.players ?? 0) +
        (last?.counts?.batting_stats ?? 0) +
        (last?.counts?.pitching_stats ?? 0) +
        (last?.counts?.games ?? 0);

      if (last?.status === "complete" && extractedCount === 0) {
        const hint =
          last.warnings?.[0] ??
          "Could not read stats or game results from this screenshot.";
        setError(
          `${hint} Try a closer crop of the stat table, or set the screenshot type to Schedule / Results and re-run extraction.`
        );
      }

      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setExtracting(false);
    }
  };

  const uploadScreenshots = async (files: File[]) => {
    if (!files.length) return;
    const authHeaders = await getAuthHeaders();
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    const res = await fetch(`/api/opponents/${opponentId}/upload`, {
      method: "POST",
      headers: authHeaders,
      body: formData,
    });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error || "Upload failed");
    }
    await onRefresh();
    await runExtraction();
  };

  const uploadDocument = async (file: File) => {
    const authHeaders = await getAuthHeaders();
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/opponents/${opponentId}/documents`, {
      method: "POST",
      headers: authHeaders,
      body: formData,
    });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error || "Document upload failed");
    }
  };

  const saveNote = async (text: string) => {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`/api/opponents/${opponentId}/notes`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        note_text: text,
        note_type: inferNoteTypeFromText(text),
        game_type: context.game_type,
        game_date: context.game_date || null,
        opponent_played: context.opponent_played || null,
      }),
    });
    if (!res.ok) throw new Error("Failed to save note");
  };

  const saveGameContext = async () => {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`/api/opponents/${opponentId}/game-context`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        game_date: context.game_date || null,
        opponent_played: context.opponent_played || null,
        tournament_name: context.tournament_name || null,
        game_type: context.game_type,
        inning_observed: context.inning_observed || null,
        leverage: context.leverage,
        notes: context.notes || composerText.trim() || null,
        result: context.result || null,
        runs_for: context.runs_for ? Number(context.runs_for) : null,
        runs_against: context.runs_against ? Number(context.runs_against) : null,
        reason_pitcher_entered: "unknown",
      }),
    });
    if (!res.ok) throw new Error("Failed to save game context");
  };

  const uploadVoiceNote = async (file: File) => {
    setTranscribing(true);
    try {
      const authHeaders = await getAuthHeaders();
      const formData = new FormData();
      formData.append("file", file);
      formData.append("game_type", context.game_type);
      if (context.game_date) formData.append("game_date", context.game_date);
      if (context.opponent_played)
        formData.append("opponent_played", context.opponent_played);
      const res = await fetch(`/api/opponents/${opponentId}/voice-notes`, {
        method: "POST",
        headers: authHeaders,
        body: formData,
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Voice note failed");
      }
    } finally {
      setTranscribing(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await uploadVoiceNote(
          new File([blob], "voice-note.webm", { type: "audio/webm" })
        );
        setRecording(false);
        await onRefresh();
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError("Microphone access denied or unavailable");
    }
  };

  const stopRecording = () => mediaRecorderRef.current?.stop();

  const handleSubmit = async () => {
    const text = composerText.trim();
    const hasContext =
      showContext &&
      (context.game_date ||
        context.opponent_played ||
        context.tournament_name ||
        context.game_type !== "unknown" ||
        context.leverage !== "medium" ||
        context.inning_observed ||
        context.notes ||
        context.result ||
        context.runs_for ||
        context.runs_against);

    if (!text && !attachedFiles.length && !hasContext) return;

    setSubmitting(true);
    setError("");
    try {
      if (text) await saveNote(text);

      if (
        hasContext &&
        (context.game_date ||
          context.opponent_played ||
          context.leverage !== "medium" ||
          context.inning_observed ||
          context.tournament_name ||
          context.notes ||
          context.result ||
          context.runs_for ||
          context.runs_against)
      ) {
        await saveGameContext();
      }

      const images = attachedFiles.filter((f) => f.type.startsWith("image/"));
      const docs = attachedFiles.filter((f) => !f.type.startsWith("image/"));

      if (images.length) await uploadScreenshots(images);
      for (const doc of docs) await uploadDocument(doc);

      setComposerText("");
      setAttachedFiles([]);
      setContext({
        game_date: "",
        opponent_played: "",
        tournament_name: "",
        game_type: "unknown",
        leverage: "medium",
        inning_observed: "",
        notes: "",
        result: "",
        runs_for: "",
        runs_against: "",
      });
      setShowContext(false);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save scout note");
    } finally {
      setSubmitting(false);
    }
  };

  const updateScreenshot = async (
    uploadId: string,
    updates: Record<string, unknown>
  ) => {
    const authHeaders = await getAuthHeaders();
    await fetch(`/api/opponents/${opponentId}/screenshots/${uploadId}`, {
      method: "PATCH",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    await onRefresh();
  };

  const handleDeleteScreenshot = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(
        `/api/opponents/${opponentId}/screenshots/${deleteTarget.id}`,
        { method: "DELETE", headers: authHeaders }
      );
      if (!res.ok) throw new Error("Delete failed");
      setDeleteTarget(null);
      setDetailUpload(null);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const deleteNote = async (noteId: string) => {
    const authHeaders = await getAuthHeaders();
    await fetch(`/api/opponents/${opponentId}/notes/${noteId}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    await onRefresh();
  };

  const deleteVoice = async (noteId: string) => {
    const authHeaders = await getAuthHeaders();
    await fetch(`/api/opponents/${opponentId}/voice-notes/${noteId}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    await onRefresh();
  };

  const deleteDocument = async (docId: string) => {
    const authHeaders = await getAuthHeaders();
    await fetch(`/api/opponents/${opponentId}/documents/${docId}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    await onRefresh();
  };

  const toggleIncluded = async (item: EvidenceLibraryItem, included: boolean) => {
    const authHeaders = await getAuthHeaders();
    if (item.kind === "screenshot" && item.screenshot) {
      await updateScreenshot(item.screenshot.id, { included_in_report: included });
      return;
    }
    const endpoints: Record<string, string> = {
      note: `notes/${item.id}`,
      voice: `voice-notes/${item.id}`,
      document: `documents/${item.id}`,
      game_context: `game-context/${item.id}`,
    };
    const path = endpoints[item.kind];
    if (!path) return;
    await fetch(`/api/opponents/${opponentId}/${path}`, {
      method: "PUT",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ included_in_report: included }),
    });
    await onRefresh();
  };

  const renderLibraryCard = (item: EvidenceLibraryItem) => {
    if (item.kind === "screenshot" && item.screenshot) {
      const upload = item.screenshot;
      return (
        <Card key={item.id} className="overflow-hidden">
          <div
            className="relative w-full aspect-[3/4] bg-muted cursor-pointer"
            onClick={() => setDetailUpload(upload)}
          >
            <Image
              src={upload.file_url}
              alt={item.title}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
          <CardContent className="p-4 space-y-3">
            <div>
              <p className="font-medium text-sm">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.subtitle}</p>
            </div>
            <ExtractionStatusBadge status={upload.extraction_status} />
            <IncludedToggle
              included={item.includedInReport}
              onChange={(v) => toggleIncluded(item, v)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDetailUpload(upload)}
              >
                <Maximize2 className="h-3 w-3 mr-1" />
                Expand
              </Button>
              <select
                value={upload.screenshot_type ?? "unknown"}
                onChange={(e) =>
                  updateScreenshot(upload.id, {
                    screenshot_type: e.target.value as ScreenshotType,
                  })
                }
                className="text-xs rounded border px-2 py-1.5 h-8"
              >
                {Object.entries(SCREENSHOT_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => setDeleteTarget(upload)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card key={item.id} className="h-full">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-lg leading-none mb-1">{KIND_ICONS[item.kind]}</p>
              <p className="font-medium text-sm">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.subtitle}</p>
            </div>
            <Badge variant="secondary" className="text-xs shrink-0">
              {KIND_LABELS[item.kind]}
            </Badge>
          </div>
          {item.preview && (
            <p className="text-sm text-muted-foreground line-clamp-6 whitespace-pre-wrap">
              {item.preview}
            </p>
          )}
          {item.kind === "game_context" && item.gameContext && (
            <div className="flex flex-wrap gap-1">
              {item.gameContext.leverage && (
                <Badge variant="outline" className="text-xs">
                  {item.gameContext.leverage} leverage
                </Badge>
              )}
              {item.gameContext.inning_observed && (
                <Badge variant="outline" className="text-xs">
                  Inning {item.gameContext.inning_observed}
                </Badge>
              )}
            </div>
          )}
          <IncludedToggle
            included={item.includedInReport}
            onChange={(v) => toggleIncluded(item, v)}
          />
          <div className="flex gap-2">
            {item.kind === "note" && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => deleteNote(item.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
            {item.kind === "voice" && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => deleteVoice(item.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
            {item.kind === "document" && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => deleteDocument(item.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8">
      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">What do you know about this team?</CardTitle>
          <p className="text-sm text-muted-foreground">
            Type observations, attach scouting sheets, or record a voice note for{" "}
            {opponentName}.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={composerText}
            onChange={(e) => setComposerText(e.target.value)}
            placeholder="Pitcher #12 relieved the starter during the bracket championship game..."
            rows={4}
            className="resize-none text-base"
          />

          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachedFiles.map((file, i) => (
                <Badge key={`${file.name}-${i}`} variant="secondary" className="gap-1">
                  <Paperclip className="h-3 w-3" />
                  {file.name}
                  <button
                    type="button"
                    className="ml-1 hover:text-destructive"
                    onClick={() =>
                      setAttachedFiles((prev) => prev.filter((_, idx) => idx !== i))
                    }
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Record voice note"
                onClick={recording ? stopRecording : startRecording}
                disabled={transcribing || submitting}
              >
                <Mic className={`h-4 w-4 ${recording ? "text-red-500" : ""}`} />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Attach screenshot"
                onClick={() => imageInputRef.current?.click()}
                disabled={submitting}
              >
                <Camera className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Attach document"
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting}
              >
                <FileText className="h-4 w-4" />
              </Button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.csv,image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={
                submitting ||
                (!composerText.trim() &&
                  !attachedFiles.length &&
                  !showContext)
              }
            >
              {submitting ? "Saving..." : "Save Scout Note"}
            </Button>
          </div>

          <button
            type="button"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setShowContext((v) => !v)}
          >
            {showContext ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            Add Context
          </button>

          {showContext && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t">
              <div>
                <Label className="text-xs">Game Date</Label>
                <Input
                  type="date"
                  value={context.game_date}
                  onChange={(e) =>
                    setContext({ ...context, game_date: e.target.value })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Opponent Played</Label>
                <Input
                  value={context.opponent_played}
                  onChange={(e) =>
                    setContext({ ...context, opponent_played: e.target.value })
                  }
                  placeholder="e.g. BAM"
                />
              </div>
              {matchedScoreLine && (
                <div className="sm:col-span-2 rounded-md bg-muted/60 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Matched game: </span>
                  <span className="font-medium">{matchedScoreLine}</span>
                  <span className="text-xs text-muted-foreground ml-1">
                    (from schedule screenshot)
                  </span>
                </div>
              )}
              <div className="sm:col-span-2 grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Result</Label>
                  <select
                    value={context.result}
                    onChange={(e) =>
                      setContext({ ...context, result: e.target.value })
                    }
                    className="w-full text-sm rounded-md border px-2 py-2 h-9"
                  >
                    <option value="">—</option>
                    <option value="W">Win</option>
                    <option value="L">Loss</option>
                    <option value="T">Tie</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Runs For</Label>
                  <Input
                    type="number"
                    min={0}
                    value={context.runs_for}
                    onChange={(e) =>
                      setContext({ ...context, runs_for: e.target.value })
                    }
                    placeholder="8"
                  />
                </div>
                <div>
                  <Label className="text-xs">Runs Against</Label>
                  <Input
                    type="number"
                    min={0}
                    value={context.runs_against}
                    onChange={(e) =>
                      setContext({ ...context, runs_against: e.target.value })
                    }
                    placeholder="3"
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Tournament</Label>
                <Input
                  value={context.tournament_name}
                  onChange={(e) =>
                    setContext({ ...context, tournament_name: e.target.value })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Game Type</Label>
                <select
                  value={context.game_type}
                  onChange={(e) =>
                    setContext({ ...context, game_type: e.target.value })
                  }
                  className="w-full text-sm rounded-md border px-2 py-2 h-9"
                >
                  {GAME_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Leverage</Label>
                <select
                  value={context.leverage}
                  onChange={(e) =>
                    setContext({ ...context, leverage: e.target.value })
                  }
                  className="w-full text-sm rounded-md border px-2 py-2 h-9"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Inning Observed</Label>
                <Input
                  value={context.inning_observed}
                  onChange={(e) =>
                    setContext({ ...context, inning_observed: e.target.value })
                  }
                  placeholder="e.g. 4th"
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Context Notes</Label>
                <Textarea
                  value={context.notes}
                  onChange={(e) =>
                    setContext({ ...context, notes: e.target.value })
                  }
                  rows={2}
                  placeholder="Entered in relief with 2 outs..."
                />
              </div>
            </div>
          )}

          {(recording || transcribing) && (
            <p className="text-sm text-muted-foreground">
              {recording ? "Recording... tap mic to stop." : "Transcribing voice note..."}
            </p>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {pendingUploads.length > 0 && (
        <Card>
          <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-sm flex-1">
              {pendingUploads.length} screenshot(s) ready for stat extraction.
            </p>
            <Button onClick={() => runExtraction()} disabled={extracting}>
              <Sparkles className="h-4 w-4 mr-1" />
              {extracting ? "Extracting..." : "Extract Stats"}
            </Button>
          </CardContent>
        </Card>
      )}

      {extracting && (
        <LoadingSpinner label="Reading stats from screenshots..." />
      )}

      {extractionSummary && (
        <p className="text-xs text-muted-foreground">
          Extracted {extractionSummary.players} players,{" "}
          {extractionSummary.batting_stats} batting rows,{" "}
          {extractionSummary.pitching_stats} pitching rows
          {extractionSummary.games > 0
            ? `, ${extractionSummary.games} game result(s)`
            : ""}
          .
        </p>
      )}

      {recentGames.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-3">Recent Games</h2>
          <RecentGamesSection games={recentGames} />
        </section>
      )}

      {timeline.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-4">Scout Notes Timeline</h2>
          <div className="space-y-6">
            {timeline.map((group) => (
              <div key={group.key} className="relative pl-4 border-l-2 border-muted">
                <div className="mb-2">
                  <p className="font-medium text-sm">{group.heading}</p>
                  <p className="text-xs text-muted-foreground">
                    {group.subtitle}
                    {group.scoreLine ? ` · ${group.scoreLine}` : ""}
                  </p>
                </div>
                <div className="space-y-2">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span>
                        {KIND_ICONS[item.kind]} {item.title}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {importanceStars(item.importance)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {screenshotItems.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-3">Screenshot Review</h2>
          <Card className="overflow-hidden">
            <div className="relative w-full aspect-[3/4] max-h-[70vh] bg-muted">
              {(() => {
                const idx = galleryIndex ?? 0;
                const item = screenshotItems[idx];
                const upload = item?.screenshot;
                if (!upload) return null;
                return (
                  <Image
                    src={upload.file_url}
                    alt={item.title}
                    fill
                    className="object-contain"
                    sizes="100vw"
                    priority
                  />
                );
              })()}
            </div>
            <CardContent className="p-4 space-y-3">
              {(() => {
                const idx = galleryIndex ?? 0;
                const item = screenshotItems[idx];
                if (!item?.screenshot) return null;
                const upload = item.screenshot;
                return (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.subtitle} · {importanceStars(item.importance)}
                        </p>
                      </div>
                      <ExtractionStatusBadge status={upload.extraction_status} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={idx <= 0}
                        onClick={() => setGalleryIndex(Math.max(0, idx - 1))}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={idx >= screenshotItems.length - 1}
                        onClick={() =>
                          setGalleryIndex(
                            Math.min(screenshotItems.length - 1, idx + 1)
                          )
                        }
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                      <span className="text-xs text-muted-foreground self-center">
                        {idx + 1} of {screenshotItems.length}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDetailUpload(upload)}
                      >
                        <Maximize2 className="h-3 w-3 mr-1" />
                        Expand
                      </Button>
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold mb-4">
          Scout Notes Library ({library.length})
        </h2>
        {library.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No scout notes yet. Tell us what you know about this team above.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {library.map(renderLibraryCard)}
          </div>
        )}
      </section>

      <ScreenshotDetailModal
        upload={detailUpload}
        open={!!detailUpload}
        onOpenChange={(open) => !open && setDetailUpload(null)}
        onRerun={(id) => runExtraction([id])}
        onDelete={setDeleteTarget}
        extracting={extracting}
      />

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this screenshot?</DialogTitle>
            <DialogDescription>
              This screenshot will be deleted and consolidated stats will update.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteScreenshot}
              disabled={deleting}
            >
              {deleting ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
