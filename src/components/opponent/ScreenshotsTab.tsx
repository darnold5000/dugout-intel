"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExtractionStatusBadge } from "@/components/ExtractionStatusBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScreenshotDetailModal } from "@/components/opponent/ScreenshotDetailModal";
import { ScreenshotUploader } from "@/components/ScreenshotUploader";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { getAuthHeaders } from "@/lib/auth-headers";
import type { ExtractionResult, ExtractionSummary, ScreenshotUpload } from "@/types";
import { Eye, RefreshCw, Sparkles, Trash2 } from "lucide-react";

interface ScreenshotsTabProps {
  opponentId: string;
  opponentName: string;
  uploads: ScreenshotUpload[];
  onRefresh: () => Promise<void>;
}

export function ScreenshotsTab({
  opponentId,
  opponentName,
  uploads,
  onRefresh,
}: ScreenshotsTabProps) {
  const [extracting, setExtracting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ScreenshotUpload | null>(null);
  const [detailUpload, setDetailUpload] = useState<ScreenshotUpload | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [extractionSummary, setExtractionSummary] = useState<ExtractionSummary | null>(null);

  const pendingUploads = useMemo(
    () =>
      uploads.filter(
        (u) =>
          u.extraction_status === "pending" || u.extraction_status === "failed"
      ),
    [uploads]
  );

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
      const data = await res.json();
      throw new Error(data.error || "Upload failed");
    }

    setExtractionSummary(null);
    await onRefresh();
  };

  const runExtraction = async (uploadIds?: string[]) => {
    setExtracting(true);
    setError("");
    setExtractionSummary(null);

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
        setError(failed?.error || data.error || "Extraction failed");
      }

      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setExtracting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(
        `/api/opponents/${opponentId}/screenshots/${deleteTarget.id}`,
        { method: "DELETE", headers: authHeaders }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Delete failed");
      }

      setDeleteTarget(null);
      if (detailUpload?.id === deleteTarget.id) {
        setDetailUpload(null);
      }
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <ScreenshotUploader onUpload={handleUpload} disabled={extracting} />
        </CardContent>
      </Card>

      {pendingUploads.length > 0 && (
        <div className="flex flex-col items-center gap-3">
          <Button onClick={() => runExtraction()} disabled={extracting} size="lg">
            <Sparkles className="h-4 w-4 mr-2" />
            {extracting
              ? "Extracting data..."
              : `Run AI extraction (${pendingUploads.length} screenshots)`}
          </Button>
        </div>
      )}

      {extracting && (
        <LoadingSpinner label="AI is extracting data from screenshots..." />
      )}

      {extractionSummary && !extracting && (
        <div className="rounded-md border bg-muted/30 p-4 text-sm">
          <p className="font-medium mb-2">Extraction complete</p>
          <p className="text-muted-foreground">
            {extractionSummary.players} players · {extractionSummary.batting_stats}{" "}
            batting · {extractionSummary.pitching_stats} pitching ·{" "}
            {extractionSummary.games} games
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {uploads.length > 0 ? (
        <div>
          <h3 className="font-semibold mb-3 text-sm text-muted-foreground">
            {uploads.length} screenshot{uploads.length === 1 ? "" : "s"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {uploads.map((upload) => {
              const warningCount = upload.extraction_warnings?.length ?? 0;

              return (
                <Card key={upload.id} className="overflow-hidden">
                  <button
                    type="button"
                    className="relative h-28 w-full bg-muted block"
                    onClick={() => setDetailUpload(upload)}
                  >
                    <Image
                      src={upload.file_url}
                      alt="Screenshot thumbnail"
                      fill
                      className="object-cover object-top"
                      sizes="200px"
                    />
                  </button>
                  <CardContent className="p-2.5 space-y-2">
                    <div className="flex items-center justify-between gap-1">
                      <ExtractionStatusBadge status={upload.extraction_status} />
                      {upload.screenshot_type && (
                        <Badge variant="outline" className="text-[10px] px-1.5 capitalize truncate max-w-[50%]">
                          {upload.screenshot_type.replace(/_/g, " ")}
                        </Badge>
                      )}
                    </div>
                    {warningCount > 0 && (
                      <button
                        type="button"
                        className="text-[11px] text-amber-700 hover:underline"
                        onClick={() => setDetailUpload(upload)}
                      >
                        {warningCount} warning{warningCount === 1 ? "" : "s"}
                      </button>
                    )}
                    {upload.extraction_error && (
                      <p className="text-[11px] text-destructive line-clamp-2">
                        Extraction failed
                      </p>
                    )}
                    <div className="flex gap-1 pt-0.5">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        title="View details"
                        onClick={() => setDetailUpload(upload)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {(upload.extraction_status === "failed" ||
                        upload.extraction_status === "complete") && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          title="Re-run extraction"
                          onClick={() => runExtraction([upload.id])}
                          disabled={extracting}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        title="Delete"
                        onClick={() => setDeleteTarget(upload)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">
          No screenshots yet. Upload GameChanger screenshots for {opponentName}.
        </p>
      )}

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
            <DialogDescription>
              Consolidated stats will be rebuilt without this screenshot.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
