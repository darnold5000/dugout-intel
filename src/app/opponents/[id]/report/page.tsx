"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScoutingReportViewer } from "@/components/ScoutingReportViewer";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ArrowLeft, Sparkles } from "lucide-react";
import type { OpponentDetail, ScoutingReport } from "@/types";

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const [opponent, setOpponent] = useState<OpponentDetail | null>(null);
  const [report, setReport] = useState<ScoutingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/opponents/${id}`);
    if (res.ok) {
      const data: OpponentDetail = await res.json();
      setOpponent(data);
      if (data.scouting_reports?.length > 0) {
        setReport(data.scouting_reports[0]);
      }
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError("");

    const res = await fetch(`/api/opponents/${id}/generate-report`, {
      method: "POST",
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Report generation failed");
      setGenerating(false);
      return;
    }

    const newReport = await res.json();
    setReport(newReport);
    setGenerating(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner label="Loading..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <AppHeader />
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Button variant="ghost" size="sm" asChild className="mb-4 no-print">
          <Link href={`/opponents/${id}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 no-print">
          <div>
            <h1 className="text-2xl font-bold">Scouting Report</h1>
            <p className="text-muted-foreground">{opponent?.name}</p>
          </div>
          <Button onClick={handleGenerate} disabled={generating}>
            <Sparkles className="h-4 w-4 mr-1" />
            {generating
              ? "Generating..."
              : report
                ? "Regenerate report"
                : "Generate report"}
          </Button>
        </div>

        {error && (
          <p className="text-sm text-destructive mb-4 no-print">{error}</p>
        )}

        {generating && (
          <div className="py-16">
            <LoadingSpinner
              size="lg"
              label="AI is writing your scouting report..."
            />
          </div>
        )}

        {!generating && !report && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                No report yet. Make sure you have extracted data, then generate
                a scouting report.
              </p>
              <div className="flex gap-3 justify-center">
                <Button asChild variant="outline">
                  <Link href={`/opponents/${id}/extracted-data`}>
                    Review data
                  </Link>
                </Button>
                <Button onClick={handleGenerate} disabled={generating}>
                  <Sparkles className="h-4 w-4 mr-1" />
                  Generate report
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!generating && report && <ScoutingReportViewer report={report} />}
      </main>
    </div>
  );
}
