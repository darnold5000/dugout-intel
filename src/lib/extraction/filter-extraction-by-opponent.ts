import { parsePlayerIdentity } from "@/lib/extraction/player-identity";
import {
  scoreTeamNameMatch,
  teamsMatch,
  tokenizeTeamName,
} from "@/lib/extraction/team-name-match";
import type { AIExtractionResult, RawExtractedTable } from "@/types";

interface TableSection {
  teamLabel: string | null;
  rows: string[][];
}

function playerKey(name: string | null, jersey: string | null): string {
  const parsed = parsePlayerIdentity(name, jersey);
  if (parsed.jersey_number) return `j:${parsed.jersey_number}`;
  const n = parsed.player_name?.toLowerCase().trim();
  return n ? `n:${n}` : "";
}

function isTeamHeaderRow(row: string[]): string | null {
  const label = (row[0]?.trim() || row.join(" ").trim()) ?? "";
  if (label.length < 4) return null;
  if (/^(lineup|team|totals?|batting|pitching|box score)$/i.test(label)) {
    return null;
  }
  if (/^#[0-9]+\s/.test(label)) return null;

  const nameBeforeJersey = label.split("#")[0]?.trim() ?? "";
  if (
    /#[0-9]+/.test(label) &&
    /^[A-Za-z]+(\s+[A-Za-z.]+)?$/.test(nameBeforeJersey)
  ) {
    return null;
  }

  const numericCells = row.filter((cell, idx) => {
    if (idx === 0) return false;
    return /^\d+\.?\d*$/.test(cell?.trim() ?? "");
  }).length;
  if (numericCells >= 2) return null;

  const hasAgeGroup = /\b\d{1,2}U\b/i.test(label);
  const wordCount = label.split(/\s+/).filter(Boolean).length;
  if (hasAgeGroup && wordCount >= 2) return label;
  if (wordCount >= 3 && !label.includes("#")) return label;

  const tokens = tokenizeTeamName(label);
  if (tokens.length >= 2 && numericCells === 0) return label;

  return null;
}

function splitTableByTeamSections(table: RawExtractedTable): TableSection[] {
  const sections: TableSection[] = [];
  let current: TableSection = { teamLabel: null, rows: [] };

  for (const row of table.rows) {
    if (!row.some((cell) => cell?.trim())) continue;

    const header = isTeamHeaderRow(row);
    if (header) {
      if (current.rows.length > 0 || current.teamLabel) {
        sections.push(current);
      }
      current = { teamLabel: header, rows: [] };
      continue;
    }

    current.rows.push(row);
  }

  if (current.rows.length > 0 || current.teamLabel) {
    sections.push(current);
  }

  return sections;
}

function collectPlayerKeysFromRows(rows: string[][]): Set<string> {
  const keys = new Set<string>();
  for (const row of rows) {
    const rawName = row[0]?.trim() || row.join(" ").trim();
    if (!rawName) continue;
    if (isTeamHeaderRow(row)) continue;
    if (/^team$/i.test(rawName)) continue;

    const identity = parsePlayerIdentity(rawName, null);
    const key = playerKey(identity.player_name, identity.jersey_number);
    if (key) keys.add(key);
  }
  return keys;
}

function rowMatchesAllowedPlayers(
  row: string[],
  allowed: Set<string>
): boolean {
  const line = row.join(" ").toLowerCase();
  for (const key of allowed) {
    if (key.startsWith("j:")) {
      const jersey = key.slice(2);
      if (line.includes(`#${jersey}`) || new RegExp(`\\b${jersey}\\b`).test(line)) {
        return true;
      }
    } else if (key.startsWith("n:")) {
      const name = key.slice(2);
      const parts = name.split(/\s+/).filter(Boolean);
      if (parts.length > 0 && parts.every((p) => line.includes(p))) {
        return true;
      }
    }
  }
  return false;
}

function filterTableRows(
  table: RawExtractedTable,
  section: TableSection,
  allowed: Set<string>
): RawExtractedTable {
  const rows: string[][] = [];
  if (section.teamLabel) {
    rows.push([section.teamLabel]);
  }
  rows.push(...section.rows);

  const supplemental = table.rows.filter((row) => {
    const text = row.join(" ").toLowerCase();
    if (!text.trim()) return false;
    if (isTeamHeaderRow(row)) return false;
    if (
      (text.includes("pitches") && text.includes("strike")) ||
      text.includes("batters faced")
    ) {
      return rowMatchesAllowedPlayers(row, allowed);
    }
    return false;
  });

  return {
    headers: table.headers,
    rows: [...rows, ...supplemental],
  };
}

function filterByPlayerKeys<T extends { player_name: string | null; jersey_number?: string | null }>(
  items: T[],
  allowed: Set<string>
): T[] {
  if (allowed.size === 0) return items;
  return items.filter((item) => {
    const key = playerKey(item.player_name, item.jersey_number ?? null);
    return key ? allowed.has(key) : false;
  });
}

export function filterExtractionByOpponent(
  extraction: AIExtractionResult,
  opponentName: string | null | undefined
): AIExtractionResult {
  const trimmed = opponentName?.trim();
  if (!trimmed) return extraction;

  const warnings = [...(extraction.warnings ?? [])];
  const table = extraction.raw_extracted_table;
  const sections =
    table?.rows?.length ? splitTableByTeamSections(table) : [];

  if (sections.length <= 1) {
    if (
      extraction.team_name &&
      !teamsMatch(trimmed, extraction.team_name) &&
      scoreTeamNameMatch(trimmed, extraction.team_name) < 0.25
    ) {
      warnings.push(
        `Extracted team "${extraction.team_name}" may not match opponent "${trimmed}".`
      );
    }
    return { ...extraction, team_name: extraction.team_name ?? trimmed, warnings };
  }

  let bestSection = sections[0];
  let bestScore = bestSection.teamLabel
    ? scoreTeamNameMatch(trimmed, bestSection.teamLabel)
    : 0;

  for (const section of sections.slice(1)) {
    const score = section.teamLabel
      ? scoreTeamNameMatch(trimmed, section.teamLabel)
      : 0;
    if (score > bestScore) {
      bestScore = score;
      bestSection = section;
    }
  }

  if (bestScore < 0.35) {
    warnings.push(
      `Could not confidently match opponent "${trimmed}" to a team section in this screenshot. Kept the closest section (${bestSection.teamLabel ?? "unlabeled"}).`
    );
  }

  const allowedPlayers = collectPlayerKeysFromRows(bestSection.rows);

  if (allowedPlayers.size === 0) {
    warnings.push(
      `Detected multiple teams but could not map player rows to "${trimmed}"; kept AI-filtered stats when possible.`
    );
    return {
      ...extraction,
      team_name: bestSection.teamLabel ?? trimmed,
      warnings,
    };
  }

  const filteredTable = table
    ? filterTableRows(table, bestSection, allowedPlayers)
    : table;

  const batting_stats = filterByPlayerKeys(extraction.batting_stats, allowedPlayers);
  const pitching_stats = filterByPlayerKeys(extraction.pitching_stats, allowedPlayers);
  const players = extraction.players.filter((p) =>
    allowedPlayers.has(playerKey(p.name, p.jersey_number))
  );

  const removed =
    extraction.batting_stats.length -
    batting_stats.length +
    (extraction.pitching_stats.length - pitching_stats.length);

  if (removed > 0) {
    warnings.push(
      `Filtered ${removed} stat row(s) from other team(s); kept data for "${trimmed}".`
    );
  }

  return {
    ...extraction,
    team_name: bestSection.teamLabel ?? trimmed,
    raw_extracted_table: filteredTable,
    batting_stats,
    pitching_stats,
    players,
    warnings,
  };
}
