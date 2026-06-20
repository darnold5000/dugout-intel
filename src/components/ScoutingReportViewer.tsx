"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, Check } from "lucide-react";
import { ReportExportActions } from "@/components/ReportExportActions";
import type { ScoutingReport, ScoutingReportJson } from "@/types";

interface ScoutingReportViewerProps {
  report: ScoutingReport;
  opponentName?: string;
}

function LeaderList({
  title,
  entries,
}: {
  title: string;
  entries: Array<{
    label: string;
    jersey_number: string | null;
    player_name: string;
    stat_line: string;
    interpretation?: string;
  }>;
}) {
  if (!entries.length) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.map((entry, i) => (
          <div key={i} className="text-sm">
            <p className="font-medium">
              {entry.jersey_number ? `#${entry.jersey_number} ` : ""}
              {entry.player_name}
            </p>
            <p className="text-muted-foreground">{entry.stat_line}</p>
            {entry.interpretation && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {entry.interpretation}
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ReportSection({
  title,
  content,
  list,
}: {
  title: string;
  content?: string;
  list?: string[];
}) {
  if (!content && (!list || list.length === 0)) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {content && <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>}
        {list && list.length > 0 && (
          <ul className="list-disc list-inside space-y-1 text-sm">
            {list.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function ScoutingReportViewer({
  report,
  opponentName,
}: ScoutingReportViewerProps) {
  const [copied, setCopied] = useState(false);
  const data = report.report_json as ScoutingReportJson;
  const isV2 = Boolean(data.executive_summary || data.pitching_staff_breakdown);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(report.report_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportActions = (
    <div className="flex flex-wrap gap-2 no-print">
      <Button variant="outline" size="sm" onClick={handleCopy}>
        {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
        {copied ? "Copied!" : "Copy report"}
      </Button>
      <ReportExportActions report={report} opponentName={opponentName} />
    </div>
  );

  if (isV2) {
    return (
      <div className="space-y-6">
        {exportActions}

        <ReportSection title="Executive Summary" content={data.executive_summary ?? data.opponent_summary} />
        <ReportSection title="Key Players To Know" list={data.key_players ?? data.players_to_watch} />
        <ReportSection title="Pitching Staff Breakdown" content={data.pitching_staff_breakdown ?? data.pitching_notes} />
        <ReportSection title="Pitcher Usage / Game Context" content={data.pitcher_usage_context} />
        <ReportSection title="Offensive Threats" content={data.offensive_threats ?? data.offensive_tendencies} />
        <ReportSection title="Baserunning Threats" content={data.baserunning_threats} />
        <ReportSection title="Weaknesses To Attack" content={data.weaknesses_to_attack ?? data.weaknesses_opportunities} />
        <ReportSection title="Recommended Game Plan" content={data.recommended_game_plan ?? data.suggested_game_plan} />
        <ReportSection title="Evidence And Confidence" content={data.evidence_and_confidence ?? data.confidence_level} />
        {data.unknowns_data_gaps.length > 0 && (
          <ReportSection title="Unknowns / Data Gaps" list={data.unknowns_data_gaps} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {exportActions}
      <Card>
        <CardHeader>
          <CardTitle>Opponent Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{data.opponent_summary}</p>
        </CardContent>
      </Card>

      {data.team_identity && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Team Identity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{data.team_identity.offensive_strength}</Badge>
              <Badge variant="outline">Power: {data.team_identity.power}</Badge>
              <Badge variant="outline">Speed: {data.team_identity.speed}</Badge>
              <Badge variant="outline">Patience: {data.team_identity.patience}</Badge>
              <Badge variant="outline">{data.team_identity.pitching_depth}</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {data.confidence_by_category && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Confidence by Category</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Offense</p>
              <p className="font-medium">{data.confidence_by_category.offense}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Pitching</p>
              <p className="font-medium">{data.confidence_by_category.pitching}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Baserunning</p>
              <p className="font-medium">{data.confidence_by_category.baserunning}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Defense</p>
              <p className="font-medium">{data.confidence_by_category.defense}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {data.offensive_leaders && data.offensive_leaders.length > 0 && (
        <LeaderList title="Offensive Leaders" entries={data.offensive_leaders} />
      )}

      {data.pitching_leaders && (
        <LeaderList
          title="Pitching Leaders"
          entries={
            Object.values(data.pitching_leaders).filter(
              (e): e is NonNullable<typeof e> => e != null
            )
          }
        />
      )}

      {data.player_scouting_cards && data.player_scouting_cards.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Players to Watch</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {data.player_scouting_cards.map((card, i) => (
              <div key={i} className="border-b last:border-0 pb-4 last:pb-0">
                <h4 className="font-semibold text-sm">
                  {card.jersey_number ? `#${card.jersey_number} ` : ""}
                  {card.player_name}
                </h4>
                <pre className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap font-sans">
                  {card.key_stats}
                </pre>
                <p className="text-sm mt-2">
                  <span className="font-medium">Assessment: </span>
                  {card.assessment}
                </p>
                <p className="text-sm mt-1">
                  <span className="font-medium">How To Attack: </span>
                  {card.how_to_attack ?? card.game_plan}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Players to Watch</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1 text-sm">
              {data.players_to_watch.map((player, i) => (
                <li key={i} className="whitespace-pre-wrap">
                  {player}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {data.base_running_threats && data.base_running_threats.length > 0 && (
        <LeaderList title="Base Running Threats" entries={data.base_running_threats} />
      )}

      {data.lineup_threat_tiers && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Lineup Threat Tiers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.lineup_threat_tiers.tier_1.length > 0 && (
              <p>
                <span className="font-medium">Tier 1: </span>
                {data.lineup_threat_tiers.tier_1.join(", ")}
              </p>
            )}
            {data.lineup_threat_tiers.tier_2.length > 0 && (
              <p>
                <span className="font-medium">Tier 2: </span>
                {data.lineup_threat_tiers.tier_2.join(", ")}
              </p>
            )}
            {data.lineup_threat_tiers.tier_3.length > 0 && (
              <p className="text-muted-foreground">
                <span className="font-medium">Tier 3: </span>
                {data.lineup_threat_tiers.tier_3.join(", ")}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {data.pitching_hierarchy && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pitching Hierarchy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Tier 1: </span>
              {data.pitching_hierarchy.tier_1.join(", ") || "None identified"}
            </p>
            <p>
              <span className="font-medium">Tier 2: </span>
              {data.pitching_hierarchy.tier_2.join(", ") || "None"}
            </p>
            <p className="text-muted-foreground">
              <span className="font-medium">Tier 3: </span>
              {data.pitching_hierarchy.tier_3.join(", ") || "None"}
            </p>
          </CardContent>
        </Card>
      )}

      {data.first_pitch_strike_analysis && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <LeaderList
            title="Pitchers Who Get Ahead"
            entries={data.first_pitch_strike_analysis.gets_ahead}
          />
          <LeaderList
            title="Pitchers Who Fall Behind"
            entries={data.first_pitch_strike_analysis.falls_behind}
          />
        </div>
      )}

      {data.pitch_count_leaders && data.pitch_count_leaders.length > 0 && (
        <LeaderList title="Pitch Count Leaders" entries={data.pitch_count_leaders} />
      )}

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
          <CardTitle>Weaknesses / Opportunities</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">
            {data.weaknesses_opportunities}
          </p>
          {data.players_to_attack && data.players_to_attack.length > 0 && (
            <p className="text-sm mt-2 text-muted-foreground">
              Attack: {data.players_to_attack.join(", ")}
            </p>
          )}
          {data.players_to_avoid && data.players_to_avoid.length > 0 && (
            <p className="text-sm mt-1 text-muted-foreground">
              Avoid: {data.players_to_avoid.join(", ")}
            </p>
          )}
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

      {data.unknowns_data_gaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Data Gaps</CardTitle>
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
