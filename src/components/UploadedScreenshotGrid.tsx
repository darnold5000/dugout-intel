import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { ExtractionStatusBadge } from "@/components/ExtractionStatusBadge";
import { Badge } from "@/components/ui/badge";
import type { ScreenshotUpload } from "@/types";
import { formatDate } from "@/lib/utils";

interface UploadedScreenshotGridProps {
  uploads: ScreenshotUpload[];
}

export function UploadedScreenshotGrid({ uploads }: UploadedScreenshotGridProps) {
  if (uploads.length === 0) return null;

  return (
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
                  {upload.screenshot_type.replace("_", " ")}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDate(upload.created_at)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
