"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScoutingReportViewer } from "@/components/ScoutingReportViewer";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Dialog as ConfirmDialog,
  DialogContent as ConfirmDialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader as ConfirmDialogHeader,
  DialogTitle as ConfirmDialogTitle,
} from "@/components/ui/dialog";
import { RebuildStatsButton } from "@/components/opponent/RebuildStatsButton";
import { getAuthHeaders } from "@/lib/auth-headers";
import { formatDate } from "@/lib/utils";
import type { ScoutingReport, ScoutingReportJson } from "@/types";
import {
  Sparkles,
  Trash2,
  Share2,
  Mail,
  Download,
  Maximize2,
  Check,
} from "lucide-react";

const REPORT_TITLES = [
  "Pre-Tournament Report",
  "State Tournament Report",
  "Pool Play Report",
  "Bracket Play Report",
];

interface ReportsTabProps {
  opponentId: string;
  reports: ScoutingReport[];
  playerCount: number;
  screenshotCount: number;
  onRefresh: () => Promise<void>;
}

export function ReportsTab({
  opponentId,
  reports,
  playerCount,
  screenshotCount,
  onRefresh,
}: ReportsTabProps) {
  const [generating, setGenerating] = useState(false);
  const [title, setTitle] = useState(REPORT_TITLES[0]);
  const [customTitle, setCustomTitle] = useState("");
  const [selectedReport, setSelectedReport] = useState<ScoutingReport | null>(
    reports[0] ?? null
  );
  const [fullScreenReport, setFullScreenReport] = useState<ScoutingReport | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScoutingReport | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const latestReportId = reports[0]?.id;

  const handleGenerate = async () => {
    setGenerating(true);
    setError("");

    try {
      const authHeaders = await getAuthHeaders();
      const reportTitle = customTitle.trim() || title;

      const res = await fetch(
        `/api/opponents/${opponentId}/generate-report`,
        {
          method: "POST",
          headers: { ...authHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ title: reportTitle }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Report generation failed");
      }

      const newReport = await res.json();
      setSelectedReport(newReport);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Report generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`/api/reports/${deleteTarget.id}`, {
        method: "DELETE",
        headers: authHeaders,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Delete failed");
      }

      if (selectedReport?.id === deleteTarget.id) {
        setSelectedReport(reports.find((r) => r.id !== deleteTarget.id) ?? null);
      }
      setDeleteTarget(null);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const handleShare = async (report: ScoutingReport) => {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`/api/reports/${report.id}`, {
      method: "POST",
      headers: authHeaders,
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to create share link");
      return;
    }

    const data = await res.json();
    setShareUrl(data.share_url);
    await navigator.clipboard.writeText(data.share_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEmailShare = (report: ScoutingReport) => {
    const summary =
      (report.report_json as ScoutingReportJson).executive_summary ??
      (report.report_json as ScoutingReportJson).opponent_summary;
    const subject = encodeURIComponent(report.title ?? "Scouting Report");
    const body = encodeURIComponent(
      `${report.title ?? "Scouting Report"}\n\n${summary}\n\n---\nFull report:\n${report.report_text.slice(0, 2000)}`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  };

  const handleDownload = (report: ScoutingReport) => {
    const blob = new Blob([report.report_text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(report.title ?? "scouting-report").replace(/\s+/g, "-").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => window.print();

  const latestReport = reports[0] ?? null;
  const displayReport = selectedReport ?? latestReport;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 no-print">
        <Button size="sm" onClick={handleGenerate} disabled={generating}>
          <Sparkles className="h-4 w-4 mr-1" />
          {generating ? "Generating..." : "Generate Report"}
        </Button>
        <RebuildStatsButton
          opponentId={opponentId}
          onComplete={onRefresh}
          size="sm"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
        <div className="space-y-1">
          <Label className="text-xs">Report title</Label>
          <select
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            {REPORT_TITLES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Custom title (optional)</Label>
          <Input
            className="h-9"
            placeholder="Override title..."
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
          />
        </div>
      </div>

      {reports.length === 0 && !generating && (
        <p className="text-sm text-muted-foreground">
          No reports yet. Add evidence in the Evidence tab, then generate your first scouting report.
        </p>
      )}

      {displayReport && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Scouting Report</CardTitle>
            <p className="text-sm text-muted-foreground">
              {displayReport.title ?? "Scouting Report"} ·{" "}
              {formatDate(displayReport.created_at)}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScoutingReportViewer report={displayReport} />
            <div className="flex flex-wrap gap-2 no-print">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFullScreenReport(displayReport)}
              >
                <Maximize2 className="h-4 w-4 mr-1" />
                Open Full Report
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                Print / PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload(displayReport)}
              >
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleShare(displayReport)}
              >
                <Share2 className="h-4 w-4 mr-1" />
                Share
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {generating && (
        <LoadingSpinner label="Building scouting intelligence and writing report..." />
      )}

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {shareUrl && copied && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 flex items-center gap-2">
          <Check className="h-4 w-4" />
          Share link copied to clipboard
        </div>
      )}

      {reports.length > 0 && (
        <>
          <div>
            <h3 className="font-semibold mb-4">Report History</h3>
            <div className="space-y-2">
              {reports.map((report) => {
                const summary =
                  (report.report_json as ScoutingReportJson).executive_summary ??
                  (report.report_json as ScoutingReportJson).opponent_summary;
                const isLatest = report.id === latestReportId;

                return (
                  <Card
                    key={report.id}
                    className={`cursor-pointer transition-colors ${
                      selectedReport?.id === report.id
                        ? "border-primary"
                        : "hover:border-muted-foreground/30"
                    }`}
                    onClick={() => setSelectedReport(report)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium truncate">
                              {report.title ?? "Scouting Report"}
                            </h4>
                            {isLatest && (
                              <Badge variant="success">Latest</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            {formatDate(report.created_at)}
                          </p>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {summary}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0 no-print">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFullScreenReport(report);
                            }}
                            title="Open full report"
                          >
                            <Maximize2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(report);
                            }}
                            title="Download"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShare(report);
                            }}
                            title="Share link"
                          >
                            <Share2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEmailShare(report);
                            }}
                            title="Email share"
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(report);
                            }}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      )}

      <Dialog
        open={!!fullScreenReport}
        onOpenChange={() => setFullScreenReport(null)}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {fullScreenReport?.title ?? "Scouting Report"}
            </DialogTitle>
          </DialogHeader>
          {fullScreenReport && (
            <ScoutingReportViewer report={fullScreenReport} />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <ConfirmDialogContent>
          <ConfirmDialogHeader>
            <ConfirmDialogTitle>Delete this report?</ConfirmDialogTitle>
            <DialogDescription>
              This action cannot be undone.
            </DialogDescription>
          </ConfirmDialogHeader>
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
        </ConfirmDialogContent>
      </ConfirmDialog>
    </div>
  );
}
