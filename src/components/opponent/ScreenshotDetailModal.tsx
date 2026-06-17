"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { RefreshCw, Trash2 } from "lucide-react";

interface ScreenshotDetailModalProps {
  upload: ScreenshotUpload | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRerun: (uploadId: string) => void;
  onDelete: (upload: ScreenshotUpload) => void;
  extracting?: boolean;
}

export function ScreenshotDetailModal({
  upload,
  open,
  onOpenChange,
  onRerun,
  onDelete,
  extracting = false,
}: ScreenshotDetailModalProps) {
  if (!upload) return null;

  const warningCount = upload.extraction_warnings?.length ?? 0;

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
              alt="GameChanger screenshot"
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
          </div>

          <p className="text-xs text-muted-foreground">
            Uploaded {formatDate(upload.created_at)}
          </p>

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
