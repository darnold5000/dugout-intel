import { formatDate } from "@/lib/utils";
import type {
  LeaderEntry,
  PlayerScoutingCard,
  ScoutingReport,
  ScoutingReportJson,
} from "@/types";

export interface ReportExportOptions {
  opponentName?: string;
  title?: string;
  createdAt?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function proseHtml(text?: string | null): string {
  if (!text?.trim()) return "";
  const escaped = escapeHtml(text.trim());
  return `<p class="prose">${escaped.replace(/\n\n+/g, "</p><p class=\"prose\">").replace(/\n/g, "<br>")}</p>`;
}

function listHtml(items: string[]): string {
  if (!items.length) return "";
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function sectionHtml(title: string, body: string): string {
  if (!body.trim()) return "";
  return `<section class="report-section"><h2>${escapeHtml(title)}</h2>${body}</section>`;
}

function leaderListHtml(title: string, entries: LeaderEntry[]): string {
  if (!entries.length) return "";
  const body = entries
    .map((entry) => {
      const jersey = entry.jersey_number ? `#${entry.jersey_number} ` : "";
      const interpretation = entry.interpretation
        ? `<p class="muted">${escapeHtml(entry.interpretation)}</p>`
        : "";
      return `<div class="leader-entry">
        <p class="leader-name"><strong>${escapeHtml(jersey + entry.player_name)}</strong>${entry.label ? ` <span class="muted">(${escapeHtml(entry.label)})</span>` : ""}</p>
        <p class="muted">${escapeHtml(entry.stat_line)}</p>
        ${interpretation}
      </div>`;
    })
    .join("");
  return sectionHtml(title, body);
}

function playerCardsHtml(cards: PlayerScoutingCard[]): string {
  if (!cards.length) return "";
  const body = cards
    .map((card) => {
      const jersey = card.jersey_number ? `#${card.jersey_number} ` : "";
      const attack = card.how_to_attack ?? card.game_plan ?? "";
      return `<div class="player-card">
        <h3>${escapeHtml(jersey + card.player_name)}</h3>
        <pre class="key-stats">${escapeHtml(card.key_stats)}</pre>
        <p><strong>Assessment:</strong> ${escapeHtml(card.assessment)}</p>
        <p><strong>How To Attack:</strong> ${escapeHtml(attack)}</p>
      </div>`;
    })
    .join("");
  return sectionHtml("Players to Watch", body);
}

function tierListHtml(title: string, tiers: { tier_1: string[]; tier_2: string[]; tier_3: string[] }): string {
  const parts: string[] = [];
  if (tiers.tier_1.length) {
    parts.push(`<p><strong>Tier 1:</strong> ${escapeHtml(tiers.tier_1.join(", "))}</p>`);
  }
  if (tiers.tier_2.length) {
    parts.push(`<p><strong>Tier 2:</strong> ${escapeHtml(tiers.tier_2.join(", "))}</p>`);
  }
  if (tiers.tier_3.length) {
    parts.push(`<p class="muted"><strong>Tier 3:</strong> ${escapeHtml(tiers.tier_3.join(", "))}</p>`);
  }
  if (!parts.length) return "";
  return sectionHtml(title, parts.join(""));
}

function buildV2Body(data: ScoutingReportJson): string {
  const sections = [
    sectionHtml(
      "Executive Summary",
      proseHtml(data.executive_summary ?? data.opponent_summary)
    ),
    sectionHtml(
      "Key Players To Know",
      listHtml(data.key_players ?? data.players_to_watch ?? [])
    ),
    sectionHtml(
      "Pitching Staff Breakdown",
      proseHtml(data.pitching_staff_breakdown ?? data.pitching_notes)
    ),
    sectionHtml("Pitcher Usage / Game Context", proseHtml(data.pitcher_usage_context)),
    sectionHtml(
      "Offensive Threats",
      proseHtml(data.offensive_threats ?? data.offensive_tendencies)
    ),
    sectionHtml("Baserunning Threats", proseHtml(data.baserunning_threats)),
    sectionHtml(
      "Weaknesses To Attack",
      proseHtml(data.weaknesses_to_attack ?? data.weaknesses_opportunities)
    ),
    sectionHtml(
      "Recommended Game Plan",
      proseHtml(data.recommended_game_plan ?? data.suggested_game_plan)
    ),
    sectionHtml(
      "Evidence And Confidence",
      proseHtml(data.evidence_and_confidence ?? data.confidence_level)
    ),
    sectionHtml("Unknowns / Data Gaps", listHtml(data.unknowns_data_gaps ?? [])),
  ];
  return sections.filter(Boolean).join("\n");
}

function buildV1Body(data: ScoutingReportJson): string {
  const sections: string[] = [];

  sections.push(
    sectionHtml("Opponent Summary", proseHtml(data.opponent_summary))
  );

  if (data.team_identity) {
    const badges = [
      data.team_identity.offensive_strength,
      `Power: ${data.team_identity.power}`,
      `Speed: ${data.team_identity.speed}`,
      `Patience: ${data.team_identity.patience}`,
      data.team_identity.pitching_depth,
    ]
      .map((b) => `<span class="badge">${escapeHtml(b)}</span>`)
      .join("");
    sections.push(sectionHtml("Team Identity", `<div class="badge-row">${badges}</div>`));
  }

  if (data.confidence_by_category) {
    const body = `<div class="grid-2">
      <p><span class="muted">Offense</span><br><strong>${escapeHtml(data.confidence_by_category.offense)}</strong></p>
      <p><span class="muted">Pitching</span><br><strong>${escapeHtml(data.confidence_by_category.pitching)}</strong></p>
      <p><span class="muted">Baserunning</span><br><strong>${escapeHtml(data.confidence_by_category.baserunning)}</strong></p>
      <p><span class="muted">Defense</span><br><strong>${escapeHtml(data.confidence_by_category.defense)}</strong></p>
    </div>`;
    sections.push(sectionHtml("Confidence by Category", body));
  }

  if (data.offensive_leaders?.length) {
    sections.push(leaderListHtml("Offensive Leaders", data.offensive_leaders));
  }

  if (data.pitching_leaders) {
    const entries = Object.values(data.pitching_leaders).filter(
      (e): e is LeaderEntry => e != null
    );
    sections.push(leaderListHtml("Pitching Leaders", entries));
  }

  if (data.player_scouting_cards?.length) {
    sections.push(playerCardsHtml(data.player_scouting_cards));
  } else if (data.players_to_watch?.length) {
    sections.push(sectionHtml("Players to Watch", listHtml(data.players_to_watch)));
  }

  if (data.base_running_threats?.length) {
    sections.push(leaderListHtml("Base Running Threats", data.base_running_threats));
  }

  if (data.lineup_threat_tiers) {
    sections.push(tierListHtml("Lineup Threat Tiers", data.lineup_threat_tiers));
  }

  if (data.pitching_hierarchy) {
    sections.push(tierListHtml("Pitching Hierarchy", data.pitching_hierarchy));
  }

  if (data.first_pitch_strike_analysis) {
    sections.push(
      leaderListHtml(
        "Pitchers Who Get Ahead",
        data.first_pitch_strike_analysis.gets_ahead
      )
    );
    sections.push(
      leaderListHtml(
        "Pitchers Who Fall Behind",
        data.first_pitch_strike_analysis.falls_behind
      )
    );
  }

  if (data.pitch_count_leaders?.length) {
    sections.push(leaderListHtml("Pitch Count Leaders", data.pitch_count_leaders));
  }

  sections.push(
    sectionHtml("Offensive Tendencies", proseHtml(data.offensive_tendencies)),
    sectionHtml("Pitching Notes", proseHtml(data.pitching_notes))
  );

  let weaknesses = proseHtml(data.weaknesses_opportunities);
  if (data.players_to_attack?.length) {
    weaknesses += `<p class="muted"><strong>Attack:</strong> ${escapeHtml(data.players_to_attack.join(", "))}</p>`;
  }
  if (data.players_to_avoid?.length) {
    weaknesses += `<p class="muted"><strong>Avoid:</strong> ${escapeHtml(data.players_to_avoid.join(", "))}</p>`;
  }
  sections.push(sectionHtml("Weaknesses / Opportunities", weaknesses));
  sections.push(sectionHtml("Suggested Game Plan", proseHtml(data.suggested_game_plan)));

  if (data.unknowns_data_gaps?.length) {
    sections.push(sectionHtml("Data Gaps", listHtml(data.unknowns_data_gaps)));
  }

  return sections.filter(Boolean).join("\n");
}

export function buildReportBodyHtml(data: ScoutingReportJson): string {
  const isV2 = Boolean(data.executive_summary || data.pitching_staff_breakdown);
  return isV2 ? buildV2Body(data) : buildV1Body(data);
}

const EXPORT_STYLES = `
  @page { margin: 0.75in; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #0f172a;
    max-width: 8.5in;
    margin: 0 auto;
    padding: 32px 24px;
    line-height: 1.5;
    background: #fff;
  }
  h1 {
    font-size: 26px;
    font-weight: 700;
    margin: 0 0 6px;
    color: #1e3a8a;
  }
  .meta {
    color: #64748b;
    font-size: 13px;
    margin-bottom: 28px;
    padding-bottom: 16px;
    border-bottom: 1px solid #e2e8f0;
  }
  .report-section {
    margin-bottom: 28px;
    page-break-inside: avoid;
  }
  h2 {
    font-size: 15px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-bottom: 2px solid #2563eb;
    padding-bottom: 6px;
    margin: 0 0 12px;
    color: #1e40af;
  }
  h3 {
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 8px;
  }
  .prose {
    font-size: 14px;
    line-height: 1.65;
    margin: 0 0 8px;
  }
  ul {
    margin: 0;
    padding-left: 20px;
  }
  li {
    margin-bottom: 8px;
    font-size: 14px;
    line-height: 1.55;
  }
  .muted {
    color: #64748b;
    font-size: 13px;
    margin: 2px 0 0;
  }
  .leader-entry {
    margin-bottom: 14px;
    padding-bottom: 10px;
    border-bottom: 1px solid #f1f5f9;
  }
  .leader-entry:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }
  .leader-name { margin: 0 0 2px; font-size: 14px; }
  .player-card {
    border-left: 3px solid #93c5fd;
    padding: 0 0 0 14px;
    margin-bottom: 18px;
  }
  .key-stats {
    font-family: inherit;
    font-size: 12px;
    color: #64748b;
    white-space: pre-wrap;
    margin: 0 0 8px;
    background: #f8fafc;
    padding: 8px 10px;
    border-radius: 4px;
  }
  .badge-row { display: flex; flex-wrap: wrap; gap: 8px; }
  .badge {
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
  }
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    font-size: 14px;
  }
  .footer {
    margin-top: 40px;
    padding-top: 14px;
    border-top: 1px solid #e2e8f0;
    font-size: 11px;
    color: #94a3b8;
    text-align: center;
  }
  @media print {
    body { padding: 0; }
    .report-section { page-break-inside: avoid; }
  }
`;

export function buildReportExportHtml(
  report: ScoutingReport,
  options: ReportExportOptions = {}
): string {
  const title = options.title ?? report.title ?? "Scouting Report";
  const opponent = options.opponentName?.trim();
  const created = options.createdAt ?? report.created_at;
  const subtitle = [opponent, formatDate(created)].filter(Boolean).join(" · ");
  const body = buildReportBodyHtml(report.report_json as ScoutingReportJson);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>${EXPORT_STYLES}</style>
</head>
<body>
  <header>
    <h1>${escapeHtml(title)}</h1>
    ${subtitle ? `<p class="meta">${escapeHtml(subtitle)}</p>` : ""}
  </header>
  <main>${body}</main>
  <footer class="footer">Generated by Dugout Intel</footer>
</body>
</html>`;
}

function reportFilename(report: ScoutingReport): string {
  return (report.title ?? "scouting-report")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

export function downloadReportHtml(
  report: ScoutingReport,
  options: ReportExportOptions = {}
): void {
  const html = buildReportExportHtml(report, options);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${reportFilename(report)}.html`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function printReportPdf(
  report: ScoutingReport,
  options: ReportExportOptions = {}
): void {
  const html = buildReportExportHtml(report, options);
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!printWindow) {
    window.alert("Pop-up blocked. Allow pop-ups to save the report as PDF.");
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();

  const triggerPrint = () => {
    printWindow.print();
  };

  if (printWindow.document.readyState === "complete") {
    setTimeout(triggerPrint, 250);
  } else {
    printWindow.onload = () => setTimeout(triggerPrint, 250);
  }
}
