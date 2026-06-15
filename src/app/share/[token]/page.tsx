"use client";

import { use, useEffect, useState } from "react";
import { ScoutingReportViewer } from "@/components/ScoutingReportViewer";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import type { ScoutingReport } from "@/types";

export default function ShareReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [report, setReport] = useState<ScoutingReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/share/${token}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Report not found");
        return res.json();
      })
      .then(setReport)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load report")
      )
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner label="Loading report..." />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">{error || "Report not found"}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8">
          <p className="text-sm text-muted-foreground">Shared Scouting Report</p>
          <h1 className="text-2xl font-bold">
            {report.title ?? "Scouting Report"}
          </h1>
        </div>
        <ScoutingReportViewer report={report} />
      </main>
    </div>
  );
}
