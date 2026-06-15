"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Check, Printer } from "lucide-react";
import type { ScoutingReport, ScoutingReportJson } from "@/types";

interface ScoutingReportViewerProps {
  report: ScoutingReport;
}

export function ScoutingReportViewer({ report }: ScoutingReportViewerProps) {
  const [copied, setCopied] = useState(false);
  const data = report.report_json as ScoutingReportJson;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(report.report_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6">
      <div className="flex gap-2 no-print">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? (
            <Check className="h-4 w-4 mr-1" />
          ) : (
            <Copy className="h-4 w-4 mr-1" />
          )}
          {copied ? "Copied!" : "Copy report"}
        </Button>
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-1" />
          Print
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Opponent Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{data.opponent_summary}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Offensive Tendencies</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{data.offensive_tendencies}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pitching Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{data.pitching_notes}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Players to Watch</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {data.players_to_watch.map((player, i) => (
              <li key={i}>{player}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Weaknesses / Opportunities</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">
            {data.weaknesses_opportunities}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Suggested Game Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{data.suggested_game_plan}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Confidence Level</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{data.confidence_level}</p>
        </CardContent>
      </Card>

      {data.unknowns_data_gaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Unknowns / Data Gaps</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              {data.unknowns_data_gaps.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
