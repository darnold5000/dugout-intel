"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScreenshotUploader } from "@/components/ScreenshotUploader";
import { UploadedScreenshotGrid } from "@/components/UploadedScreenshotGrid";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ArrowLeft, Sparkles } from "lucide-react";
import type { OpponentDetail, ScreenshotUpload } from "@/types";

export default function UploadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [opponent, setOpponent] = useState<OpponentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");

  const fetchOpponent = useCallback(async () => {
    const res = await fetch(`/api/opponents/${id}`);
    if (res.ok) {
      setOpponent(await res.json());
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchOpponent();
  }, [fetchOpponent]);

  const handleUpload = async (files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    const res = await fetch(`/api/opponents/${id}/upload`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Upload failed");
    }

    await fetchOpponent();
  };

  const handleExtract = async () => {
    setExtracting(true);
    setError("");

    const res = await fetch(`/api/opponents/${id}/extract`, {
      method: "POST",
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Extraction failed");
      setExtracting(false);
      return;
    }

    await fetchOpponent();
    setExtracting(false);
    router.push(`/opponents/${id}/extracted-data`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner label="Loading..." />
      </div>
    );
  }

  const uploads = opponent?.screenshot_uploads ?? [];
  const pendingUploads = uploads.filter(
    (u: ScreenshotUpload) =>
      u.extraction_status === "pending" || u.extraction_status === "failed"
  );

  return (
    <div className="min-h-screen bg-muted/20">
      <AppHeader />
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href={`/opponents/${id}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>

        <h1 className="text-2xl font-bold mb-2">Upload Screenshots</h1>
        <p className="text-muted-foreground mb-6">
          Upload GameChanger screenshots for {opponent?.name}
        </p>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base">Add screenshots</CardTitle>
          </CardHeader>
          <CardContent>
            <ScreenshotUploader onUpload={handleUpload} />
          </CardContent>
        </Card>

        {uploads.length > 0 && (
          <>
            <h2 className="text-lg font-semibold mb-4">
              Uploaded ({uploads.length})
            </h2>
            <UploadedScreenshotGrid uploads={uploads} />

            {pendingUploads.length > 0 && (
              <div className="mt-8 flex flex-col items-center gap-3">
                <Button
                  onClick={handleExtract}
                  disabled={extracting}
                  size="lg"
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  {extracting
                    ? "Extracting data..."
                    : `Run AI extraction (${pendingUploads.length} screenshots)`}
                </Button>
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
              </div>
            )}

            {pendingUploads.length === 0 && uploads.length > 0 && (
              <div className="mt-8 text-center">
                <Button asChild>
                  <Link href={`/opponents/${id}/extracted-data`}>
                    View extracted data
                  </Link>
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
