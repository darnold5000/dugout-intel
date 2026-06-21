"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExtractionStatusBadge } from "@/components/ExtractionStatusBadge";
import { RawExtractedTableViewer } from "@/components/RawExtractedTableViewer";
import { formatDate } from "@/lib/utils";
import type { ScreenshotUpload } from "@/types";
import { RefreshCw, Save, Trash2 } from "lucide-react";

interface ScreenshotDetailModalProps {
  upload: ScreenshotUpload | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRerun: (uploadId: string) => void;
  onDelete: (upload: ScreenshotUpload) => void;
  onUpdate?: (
    uploadId: string,
    updates: Record<string, unknown>
  ) => Promise<void>;
  extracting?: boolean;
}

export function ScreenshotDetailModal({
  upload,
  open,
  onOpenChange,
  onRerun,
  onDelete,
  onUpdate,
  extracting = false,
}: ScreenshotDetailModalProps) {
  const [gameDate, setGameDate] = useState("");
  const [opponentPlayed, setOpponentPlayed] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);

  useEffect(() => {
    if (!upload) return;
    setGameDate(upload.game_date?.slice(0, 10) ?? "");
    setOpponentPlayed(upload.opponent_played ?? "");
  }, [upload]);

  if (!upload) return null;

  const warningCount = upload.extraction_warnings?.length ?? 0;
  const needsGameTags = !upload.game_date;

  const saveGameTags = async () => {
    if (!onUpdate) return;
    setSavingMeta(true);
    try {
      await onUpdate(upload.id, {
        game_date: gameDate || null,
        opponent_played: opponentPlayed.trim() || null,
      });
    } finally {
      setSavingMeta(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Screenshot Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative h-64 w-full rounded-md bg-muted overflow-hidden">
            <Image
              src={upload.file_url}
              alt="Uploaded screenshot"
              fill
              className="object-contain"
              sizes="400px"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ExtractionStatusBadge status={upload.extraction_status} />
            {upload.screenshot_type && (
              <Badge variant="outline" className="text-xs capitalize">
                {upload.screenshot_type.replace(/_/g, " ")}
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="warning" className="text-xs">
                {warningCount} warning{warningCount === 1 ? "" : "s"}
              </Badge>
            )}
            {needsGameTags && (
              <Badge variant="secondary" className="text-xs">
                Needs game date
              </Badge>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Uploaded {formatDate(upload.created_at)}
          </p>

          {onUpdate && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-3">
              <p className="text-xs font-medium">
                Game tags (required for Pitching Ledger)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Game date</Label>
                  <Input
                    type="date"
                    value={gameDate}
                    onChange={(e) => setGameDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Opponent played</Label>
                  <Input
                    value={opponentPlayed}
                    onChange={(e) => setOpponentPlayed(e.target.value)}
                    placeholder="e.g. BAM"
                  />
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={saveGameTags}
                disabled={savingMeta || !gameDate}
              >
                <Save className="h-3 w-3 mr-1" />
                {savingMeta ? "Saving..." : "Save game tags"}
              </Button>
            </div>
          )}

          {upload.extraction_error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {upload.extraction_error}
            </div>
          )}

          <RawExtractedTableViewer
            table={upload.raw_extracted_table}
            warnings={upload.extraction_warnings}
            compact
          />

          <div className="flex gap-2 pt-2">
            {(upload.extraction_status === "failed" ||
              upload.extraction_status === "complete") && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onRerun(upload.id)}
                disabled={extracting}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Re-run extraction
              </Button>
            )}
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                onOpenChange(false);
                onDelete(upload);
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
