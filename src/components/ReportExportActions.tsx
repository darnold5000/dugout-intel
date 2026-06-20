"use client";

import { Button } from "@/components/ui/button";
import {
  downloadReportHtml,
  printReportPdf,
} from "@/lib/scouting/report-export";
import type { ScoutingReport } from "@/types";
import { Download, FileText } from "lucide-react";

interface ReportExportActionsProps {
  report: ScoutingReport;
  opponentName?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost";
}

export function ReportExportActions({
  report,
  opponentName,
  size = "sm",
  variant = "outline",
}: ReportExportActionsProps) {
  const options = {
    opponentName,
    title: report.title ?? undefined,
    createdAt: report.created_at,
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => downloadReportHtml(report, options)}
      >
        <Download className="h-4 w-4 mr-1" />
        Download
      </Button>
      <Button
        variant={variant}
        size={size}
        onClick={() => printReportPdf(report, options)}
      >
        <FileText className="h-4 w-4 mr-1" />
        Save as PDF
      </Button>
    </>
  );
}
