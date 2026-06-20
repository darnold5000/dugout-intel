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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { RebuildStatsButton } from "@/components/opponent/RebuildStatsButton";
import { GameDayCard } from "@/components/opponent/GameDayCard";
import { ReportExportActions } from "@/components/ReportExportActions";
import { reportNeedsRefresh } from "@/lib/scouting/opponent-dashboard";
import { getAuthHeaders } from "@/lib/auth-headers";
import { formatDate } from "@/lib/utils";
import type { OpponentDetail, ScoutingReport, ScoutingReportJson } from "@/types";
import {
  Sparkles,
  Trash2,
  Share2,
  Mail,
  Maximize2,
  Check,
  RefreshCw,
} from "lucide-react";

const REPORT_TITLES = [
  "Pre-Tournament Report",
  "State Tournament Report",
  "Pool Play Report",
  "Bracket Play Report",
];

interface ReportsTabProps {
  opponentId: string;
  opponentName: string;
  data: OpponentDetail;
  reports: ScoutingReport[];
  onRefresh: () => Promise<void>;
}

export function ReportsTab({
  opponentId,
  opponentName,
  data,
  reports,
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
  const latestReport = reports[0] ?? null;
  const displayReport = selectedReport ?? latestReport;
  const stale = reportNeedsRefresh(data);

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

  return (
    <div className="space-y-6">
      {stale && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <p className="font-medium text-sm">Scout notes changed</p>
              <p className="text-sm text-muted-foreground">
                Your scouting report may be out of date. Refresh it to include
                the latest notes and screenshots.
              </p>
            </div>
            <Button onClick={handleGenerate} disabled={generating}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {generating ? "Refreshing..." : "Refresh Report"}
            </Button>
          </CardContent>
        </Card>
      )}

      <GameDayCard
        opponentName={opponentName}
        data={data}
        report={displayReport}
      />

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg">Generate Scouting Report</CardTitle>
          <p className="text-sm text-muted-foreground">
            Turn scout notes into a coach-ready report.
          </p>
          {latestReport && !stale && (
            <p className="text-xs text-muted-foreground">
              Report current as of {formatDate(latestReport.created_at)}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
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

          <div className="flex flex-wrap gap-2 no-print">
            <Button size="lg" onClick={handleGenerate} disabled={generating}>
              <Sparkles className="h-4 w-4 mr-2" />
              {generating
                ? "Generating..."
                : latestReport
                  ? "Regenerate Report"
                  : "Generate Report"}
            </Button>
            <RebuildStatsButton
              opponentId={opponentId}
              onComplete={onRefresh}
              size="lg"
              variant="outline"
            />
            {displayReport && (
              <ReportExportActions
                report={displayReport}
                opponentName={opponentName}
                size="lg"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {reports.length === 0 && !generating && (
        <p className="text-sm text-muted-foreground">
          No reports yet. Add scout notes, then generate your first scouting
          report.
        </p>
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

      {displayReport && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {displayReport.title ?? "Scouting Report"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {formatDate(displayReport.created_at)}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScoutingReportViewer
              report={displayReport}
              opponentName={opponentName}
            />
            <div className="flex flex-wrap gap-2 no-print">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFullScreenReport(displayReport)}
              >
                <Maximize2 className="h-4 w-4 mr-1" />
                Open Full Report
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleShare(displayReport)}
              >
                <Share2 className="h-4 w-4 mr-1" />
                Share
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEmailShare(displayReport)}
              >
                <Mail className="h-4 w-4 mr-1" />
                Email
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {reports.length > 0 && (
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
                          {isLatest && <Badge variant="success">Latest</Badge>}
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
                            handleShare(report);
                          }}
                          title="Share link"
                        >
                          <Share2 className="h-4 w-4" />
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
            <ScoutingReportViewer
              report={fullScreenReport}
              opponentName={opponentName}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this report?</DialogTitle>
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
