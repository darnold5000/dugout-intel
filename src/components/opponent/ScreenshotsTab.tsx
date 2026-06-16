"use client";

import { useState } from "react";
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
import { RawExtractedTableViewer } from "@/components/RawExtractedTableViewer";
import { ScreenshotUploader } from "@/components/ScreenshotUploader";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { getAuthHeaders } from "@/lib/auth-headers";
import { formatDate } from "@/lib/utils";
import type { ExtractionResult, ExtractionSummary, ScreenshotUpload } from "@/types";
import { Sparkles, Trash2, RefreshCw } from "lucide-react";

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
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [extractionResult, setExtractionResult] = useState<{
    totals: ExtractionSummary;
    results: ExtractionResult[];
  } | null>(null);

  const pendingUploads = uploads.filter(
    (u) => u.extraction_status === "pending" || u.extraction_status === "failed"
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

    setExtractionResult(null);
    await onRefresh();
  };

  const runExtraction = async (uploadIds?: string[]) => {
    setExtracting(true);
    setError("");
    setExtractionResult(null);

    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`/api/opponents/${opponentId}/extract`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(uploadIds ? { upload_ids: uploadIds } : {}),
      });

      const data = await res.json();

      if (data.totals) {
        setExtractionResult({ totals: data.totals, results: data.results });
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
            <Sparkles className="h-4 w-4 mr-1" />
            {extracting
              ? "Extracting data..."
              : `Run AI extraction (${pendingUploads.length} screenshots)`}
          </Button>
        </div>
      )}

      {extracting && (
        <div className="py-8">
          <LoadingSpinner label="AI is extracting data from screenshots..." />
        </div>
      )}

      {extractionResult && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">Extraction complete</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Players:</span>{" "}
                <strong>{extractionResult.totals.players}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Batting Stats:</span>{" "}
                <strong>{extractionResult.totals.batting_stats}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Pitching Stats:</span>{" "}
                <strong>{extractionResult.totals.pitching_stats}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Games:</span>{" "}
                <strong>{extractionResult.totals.games}</strong>
              </div>
            </div>
            {extractionResult.results.map((result) =>
              result.status === "complete" &&
              (result.raw_extracted_table || result.warnings?.length) ? (
                <div key={result.upload_id} className="mt-4">
                  <RawExtractedTableViewer
                    table={result.raw_extracted_table ?? null}
                    warnings={result.warnings}
                  />
                </div>
              ) : null
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {uploads.length > 0 ? (
        <div>
          <h3 className="font-semibold mb-4">
            Screenshots ({uploads.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {uploads.map((upload) => (
              <Card key={upload.id} className="overflow-hidden">
                <div className="relative aspect-[9/16] max-h-64 bg-muted">
                  <Image
                    src={upload.file_url}
                    alt="GameChanger screenshot"
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                </div>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <ExtractionStatusBadge status={upload.extraction_status} />
                    {upload.screenshot_type && (
                      <Badge variant="outline" className="text-xs">
                        {upload.screenshot_type.replace(/_/g, " ")}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(upload.created_at)}
                  </p>
                  {upload.extraction_error && (
                    <p className="text-xs text-destructive bg-destructive/10 rounded p-2">
                      {upload.extraction_error}
                    </p>
                  )}
                  <RawExtractedTableViewer
                    table={upload.raw_extracted_table}
                    warnings={upload.extraction_warnings}
                  />
                  <div className="flex gap-2 pt-1">
                    {(upload.extraction_status === "failed" ||
                      upload.extraction_status === "complete") && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => runExtraction([upload.id])}
                        disabled={extracting}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Re-run
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(upload)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">
          No screenshots yet. Upload GameChanger screenshots for {opponentName}.
        </p>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this screenshot?</DialogTitle>
            <DialogDescription>
              This action cannot be undone.
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
