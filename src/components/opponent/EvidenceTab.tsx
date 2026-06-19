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
import { ScreenshotUploader } from "@/components/ScreenshotUploader";
import { ScreenshotDetailModal } from "@/components/opponent/ScreenshotDetailModal";
import { ExtractionStatusBadge } from "@/components/ExtractionStatusBadge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { getAuthHeaders } from "@/lib/auth-headers";
import { formatDate } from "@/lib/utils";
import type {
  ExtractionResult,
  ExtractionSummary,
  OpponentDetail,
  ScreenshotType,
  ScreenshotUpload,
} from "@/types";
import {
  Camera,
  FileText,
  Mic,
  Plus,
  Sparkles,
  Trash2,
  Upload,
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
  unknown: "Unknown",
};

const GAME_TYPES = [
  { value: "unknown", label: "Unknown" },
  { value: "pool_play", label: "Pool Play" },
  { value: "bracket_play", label: "Bracket Play" },
  { value: "championship", label: "Championship" },
  { value: "friendly", label: "Friendly" },
  { value: "scrimmage", label: "Scrimmage" },
];

const NOTE_TYPES = [
  { value: "general", label: "General" },
  { value: "pitching", label: "Pitching" },
  { value: "hitting", label: "Hitting" },
  { value: "baserunning", label: "Baserunning" },
  { value: "defense", label: "Defense" },
  { value: "tournament_context", label: "Tournament Context" },
];

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
    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
      <input
        type="checkbox"
        checked={included}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded"
      />
      In report
    </label>
  );
}

export function EvidenceTab({
  opponentId,
  opponentName,
  data,
  onRefresh,
}: EvidenceTabProps) {
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");
  const [extractionSummary, setExtractionSummary] =
    useState<ExtractionSummary | null>(null);
  const [detailUpload, setDetailUpload] = useState<ScreenshotUpload | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScreenshotUpload | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState("general");
  const [noteGameType, setNoteGameType] = useState("unknown");
  const [noteImportance] = useState("medium");
  const [savingNote, setSavingNote] = useState(false);

  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [showContextForm, setShowContextForm] = useState(false);
  const [contextForm, setContextForm] = useState({
    game_date: "",
    opponent_played: "",
    tournament_name: "",
    game_type: "unknown",
    inning_observed: "",
    score_when_pitcher_entered: "",
    reason_pitcher_entered: "unknown",
    leverage: "medium",
    notes: "",
  });

  const documentInputRef = useRef<HTMLInputElement>(null);
  const voiceFileInputRef = useRef<HTMLInputElement>(null);

  const uploads = data.screenshot_uploads ?? [];
  const notes = data.opponent_notes ?? [];
  const voiceNotes = data.opponent_voice_notes ?? [];
  const documents = data.opponent_documents ?? [];
  const gameContexts = data.opponent_game_context ?? [];

  const pendingUploads = useMemo(
    () =>
      uploads.filter(
        (u) =>
          u.extraction_status === "pending" || u.extraction_status === "failed"
      ),
    [uploads]
  );

  const evidenceCount =
    uploads.length + notes.length + voiceNotes.length + documents.length + gameContexts.length;

  const handleUpload = async (files: File[]) => {
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
    setExtractionSummary(null);
    await onRefresh();
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
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Extraction failed");
      }
      const results = (await res.json()) as ExtractionResult[];
      const last = results[results.length - 1];
      if (last?.counts) setExtractionSummary(last.counts);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setExtracting(false);
    }
  };

  const updateScreenshot = async (uploadId: string, updates: Record<string, unknown>) => {
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

  const saveNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`/api/opponents/${opponentId}/notes`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          note_text: noteText,
          note_type: noteType,
          game_type: noteGameType,
          importance: noteImportance,
        }),
      });
      if (!res.ok) throw new Error("Failed to save note");
      setNoteText("");
      setShowNoteForm(false);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSavingNote(false);
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

  const uploadVoiceNote = async (file: File) => {
    setTranscribing(true);
    try {
      const authHeaders = await getAuthHeaders();
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/opponents/${opponentId}/voice-notes`, {
        method: "POST",
        headers: authHeaders,
        body: formData,
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Voice note upload failed");
      }
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Voice note failed");
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
        await uploadVoiceNote(new File([blob], "voice-note.webm", { type: "audio/webm" }));
        setRecording(false);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError("Microphone access denied or unavailable");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
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
    await onRefresh();
  };

  const saveGameContext = async () => {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`/api/opponents/${opponentId}/game-context`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(contextForm),
    });
    if (!res.ok) throw new Error("Failed to save game context");
    setShowContextForm(false);
    setContextForm({
      game_date: "",
      opponent_played: "",
      tournament_name: "",
      game_type: "unknown",
      inning_observed: "",
      score_when_pitcher_entered: "",
      reason_pitcher_entered: "unknown",
      leverage: "medium",
      notes: "",
    });
    await onRefresh();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Add Evidence</CardTitle>
          <p className="text-sm text-muted-foreground">
            Build a scouting packet for {opponentName}. {evidenceCount} item(s) collected.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => document.getElementById("screenshot-upload")?.scrollIntoView({ behavior: "smooth" })}>
            <Camera className="h-4 w-4 mr-1" /> Upload Screenshot
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowNoteForm(true)}>
            <FileText className="h-4 w-4 mr-1" /> Add Written Note
          </Button>
          <Button variant="outline" size="sm" onClick={recording ? stopRecording : startRecording} disabled={transcribing}>
            <Mic className="h-4 w-4 mr-1" /> {recording ? "Stop Recording" : transcribing ? "Transcribing..." : "Record Voice Note"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => voiceFileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" /> Upload Audio
          </Button>
          <Button variant="outline" size="sm" onClick={() => documentInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" /> Upload Document
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowContextForm(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Game Context
          </Button>
          <input ref={voiceFileInputRef} type="file" accept="audio/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadVoiceNote(f); e.target.value = ""; }} />
          <input ref={documentInputRef} type="file" accept=".pdf,.txt,.csv,image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDocument(f); e.target.value = ""; }} />
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card id="screenshot-upload">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Screenshots</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScreenshotUploader onUpload={handleUpload} disabled={extracting} />
          {pendingUploads.length > 0 && (
            <Button onClick={() => runExtraction()} disabled={extracting}>
              <Sparkles className="h-4 w-4 mr-1" />
              {extracting ? "Extracting..." : `Run AI extraction (${pendingUploads.length})`}
            </Button>
          )}
          {extracting && <LoadingSpinner label="Extracting stats from screenshots..." />}
          {extractionSummary && (
            <p className="text-xs text-muted-foreground">
              Extracted: {extractionSummary.players} players, {extractionSummary.batting_stats} batting, {extractionSummary.pitching_stats} pitching
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {uploads.map((upload) => (
              <div key={upload.id} className="border rounded-lg p-2 space-y-2">
                <div className="relative aspect-video bg-muted rounded overflow-hidden cursor-pointer" onClick={() => setDetailUpload(upload)}>
                  <Image src={upload.file_url} alt="Screenshot" fill className="object-cover" sizes="200px" />
                </div>
                <div className="space-y-1">
                  <select
                    value={upload.screenshot_type ?? "unknown"}
                    onChange={(e) => updateScreenshot(upload.id, { screenshot_type: e.target.value as ScreenshotType })}
                    className="w-full text-xs rounded border px-1 py-1"
                  >
                    {Object.entries(SCREENSHOT_TYPE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                  <ExtractionStatusBadge status={upload.extraction_status} />
                  <IncludedToggle
                    included={upload.included_in_report !== false}
                    onChange={(v) => updateScreenshot(upload.id, { included_in_report: v })}
                  />
                  <Button variant="ghost" size="sm" className="h-7 text-destructive" onClick={() => setDeleteTarget(upload)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Coach Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
          {notes.map((note) => (
            <div key={note.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Badge variant="secondary" className="text-xs">{note.note_type}</Badge>
                  <Badge variant="outline" className="text-xs ml-1">{note.importance}</Badge>
                  {note.game_type !== "unknown" && (
                    <Badge variant="outline" className="text-xs ml-1">{note.game_type}</Badge>
                  )}
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-destructive" onClick={() => deleteNote(note.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-sm whitespace-pre-wrap">{note.note_text}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{formatDate(note.created_at)}</span>
                <IncludedToggle
                  included={note.included_in_report}
                  onChange={async (v) => {
                    const authHeaders = await getAuthHeaders();
                    await fetch(`/api/opponents/${opponentId}/notes/${note.id}`, {
                      method: "PUT",
                      headers: { ...authHeaders, "Content-Type": "application/json" },
                      body: JSON.stringify({ included_in_report: v }),
                    });
                    await onRefresh();
                  }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Voice Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {voiceNotes.length === 0 && <p className="text-sm text-muted-foreground">No voice notes yet.</p>}
          {voiceNotes.map((vn) => (
            <div key={vn.id} className="border rounded-lg p-3 space-y-2">
              <Badge variant="secondary" className="text-xs">{vn.note_type}</Badge>
              <Textarea
                defaultValue={vn.transcript_text ?? ""}
                className="text-sm min-h-[80px]"
                onBlur={async (e) => {
                  const authHeaders = await getAuthHeaders();
                  await fetch(`/api/opponents/${opponentId}/voice-notes/${vn.id}`, {
                    method: "PUT",
                    headers: { ...authHeaders, "Content-Type": "application/json" },
                    body: JSON.stringify({ transcript_text: e.target.value }),
                  });
                }}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{formatDate(vn.created_at)}</span>
                <IncludedToggle
                  included={vn.included_in_report}
                  onChange={async (v) => {
                    const authHeaders = await getAuthHeaders();
                    await fetch(`/api/opponents/${opponentId}/voice-notes/${vn.id}`, {
                      method: "PUT",
                      headers: { ...authHeaders, "Content-Type": "application/json" },
                      body: JSON.stringify({ included_in_report: v }),
                    });
                    await onRefresh();
                  }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {documents.length === 0 && <p className="text-sm text-muted-foreground">No documents yet.</p>}
          {documents.map((doc) => (
            <div key={doc.id} className="border rounded-lg p-3 space-y-2">
              <p className="font-medium text-sm">{doc.file_name}</p>
              {doc.extracted_text && (
                <p className="text-xs text-muted-foreground line-clamp-4 whitespace-pre-wrap">
                  {doc.extracted_text}
                </p>
              )}
              <IncludedToggle
                included={doc.included_in_report}
                onChange={async (v) => {
                  const authHeaders = await getAuthHeaders();
                  await fetch(`/api/opponents/${opponentId}/documents/${doc.id}`, {
                    method: "PUT",
                    headers: { ...authHeaders, "Content-Type": "application/json" },
                    body: JSON.stringify({ included_in_report: v }),
                  });
                  await onRefresh();
                }}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Game Context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {gameContexts.length === 0 && <p className="text-sm text-muted-foreground">No game context entries yet.</p>}
          {gameContexts.map((ctx) => (
            <div key={ctx.id} className="border rounded-lg p-3 space-y-1">
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">{ctx.game_type}</Badge>
                {ctx.leverage && <Badge variant="secondary">{ctx.leverage} leverage</Badge>}
              </div>
              {ctx.opponent_played && <p className="text-sm">vs {ctx.opponent_played}</p>}
              {ctx.tournament_name && <p className="text-xs text-muted-foreground">{ctx.tournament_name}</p>}
              {ctx.notes && <p className="text-sm">{ctx.notes}</p>}
              {ctx.inning_observed && <p className="text-xs">Inning: {ctx.inning_observed}</p>}
              {ctx.score_when_pitcher_entered && <p className="text-xs">Score: {ctx.score_when_pitcher_entered}</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={showNoteForm} onOpenChange={setShowNoteForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Coach Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="#18 came in during the 3rd inning..." rows={5} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Type</Label>
                <select value={noteType} onChange={(e) => setNoteType(e.target.value)} className="w-full text-sm rounded border px-2 py-1.5">
                  {NOTE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">Game Type</Label>
                <select value={noteGameType} onChange={(e) => setNoteGameType(e.target.value)} className="w-full text-sm rounded border px-2 py-1.5">
                  {GAME_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveNote} disabled={savingNote || !noteText.trim()}>
              {savingNote ? "Saving..." : "Save Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showContextForm} onOpenChange={setShowContextForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Game Context</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Game Date</Label><Input type="date" value={contextForm.game_date} onChange={(e) => setContextForm({ ...contextForm, game_date: e.target.value })} /></div>
            <div><Label className="text-xs">Opponent Played</Label><Input value={contextForm.opponent_played} onChange={(e) => setContextForm({ ...contextForm, opponent_played: e.target.value })} /></div>
            <div className="col-span-2"><Label className="text-xs">Tournament</Label><Input value={contextForm.tournament_name} onChange={(e) => setContextForm({ ...contextForm, tournament_name: e.target.value })} /></div>
            <div><Label className="text-xs">Game Type</Label>
              <select value={contextForm.game_type} onChange={(e) => setContextForm({ ...contextForm, game_type: e.target.value })} className="w-full text-sm rounded border px-2 py-1.5">
                {GAME_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div><Label className="text-xs">Leverage</Label>
              <select value={contextForm.leverage} onChange={(e) => setContextForm({ ...contextForm, leverage: e.target.value })} className="w-full text-sm rounded border px-2 py-1.5">
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
              </select>
            </div>
            <div className="col-span-2"><Label className="text-xs">Notes</Label><Textarea value={contextForm.notes} onChange={(e) => setContextForm({ ...contextForm, notes: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button onClick={saveGameContext}>Save Context</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <DialogTitle>Delete this screenshot?</DialogTitle>
            <DialogDescription>This will also rebuild consolidated stats.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteScreenshot} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
