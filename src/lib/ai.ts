import OpenAI from "openai";
import type { AIExtractionResult, ScoutingReportJson } from "@/types";

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const EXTRACTION_SYSTEM_PROMPT = `You are a youth baseball data extraction assistant. You analyze GameChanger app screenshots and extract structured data.

RULES:
- Never invent missing stats or player information
- Mark uncertain values with lower confidence (0.0-1.0 scale)
- Preserve jersey numbers exactly when visible
- Distinguish confirmed facts from assumptions
- Return null for unreadable or missing fields
- Include warnings if screenshot quality is poor or text is partially obscured
- Include unknowns for data you cannot determine

Return ONLY valid JSON matching this schema:
{
  "screenshot_type": "roster | schedule | box_score | batting_stats | pitching_stats | game_summary | unknown",
  "team_name": string | null,
  "players": [{ "name": string | null, "jersey_number": string | null, "positions": string[] | null, "confidence": number }],
  "batting_stats": [{ "player_name": string | null, "jersey_number": string | null, "avg": number | null, "obp": number | null, "ops": number | null, "hits": number | null, "walks": number | null, "strikeouts": number | null, "rbi": number | null, "runs": number | null, "stolen_bases": number | null, "confidence": number }],
  "pitching_stats": [{ "player_name": string | null, "jersey_number": string | null, "innings_pitched": number | null, "pitches": number | null, "strike_percentage": number | null, "era": number | null, "walks": number | null, "strikeouts": number | null, "hits_allowed": number | null, "runs_allowed": number | null, "confidence": number }],
  "games": [{ "opponent_name": string | null, "game_date": string | null, "result": string | null, "runs_for": number | null, "runs_against": number | null, "notes": string | null, "confidence": number }],
  "warnings": string[],
  "unknowns": string[]
}`;

const REPORT_SYSTEM_PROMPT = `You are a youth baseball scouting assistant writing reports for coaches of 9U-12U travel ball teams.

Write in plain English, coach-friendly tone. Be practical and actionable. Do not invent stats not provided in the data.

Return ONLY valid JSON matching this schema:
{
  "opponent_summary": string,
  "offensive_tendencies": string,
  "pitching_notes": string,
  "players_to_watch": string[],
  "weaknesses_opportunities": string,
  "suggested_game_plan": string,
  "confidence_level": string,
  "unknowns_data_gaps": string[]
}`;

export async function extractFromScreenshot(
  imageDataUrl: string
): Promise<AIExtractionResult> {
  let response;
  try {
    response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all baseball data from this GameChanger screenshot. Return structured JSON only.",
            },
            {
              type: "image_url",
              image_url: { url: imageDataUrl, detail: "high" },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 4096,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "OpenAI request failed";
    throw new Error(`OpenAI error: ${message}`);
  }

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty extraction response");
  }

  try {
    return JSON.parse(content) as AIExtractionResult;
  } catch {
    throw new Error("Failed to parse OpenAI extraction JSON response");
  }
}

export async function generateScoutingReport(data: {
  opponentName: string;
  ageLevel: string;
  players: unknown[];
  battingStats: unknown[];
  pitchingStats: unknown[];
  games: unknown[];
}): Promise<{ reportJson: ScoutingReportJson; reportText: string }> {
  let response;
  try {
    response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: REPORT_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Generate a scouting report for opponent "${data.opponentName}" (${data.ageLevel}).

Extracted data:
${JSON.stringify(data, null, 2)}

Write practical advice for a youth baseball coach preparing to play this team.`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 4096,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "OpenAI request failed";
    throw new Error(`OpenAI error: ${message}`);
  }

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No report response from AI");

  const reportJson = JSON.parse(content) as ScoutingReportJson;
  const reportText = formatReportText(data.opponentName, reportJson);

  return { reportJson, reportText };
}

function formatReportText(
  opponentName: string,
  report: ScoutingReportJson
): string {
  const sections = [
    `# Scouting Report: ${opponentName}`,
    "",
    "## Opponent Summary",
    report.opponent_summary,
    "",
    "## Offensive Tendencies",
    report.offensive_tendencies,
    "",
    "## Pitching Notes",
    report.pitching_notes,
    "",
    "## Players to Watch",
    ...report.players_to_watch.map((p) => `- ${p}`),
    "",
    "## Weaknesses / Opportunities",
    report.weaknesses_opportunities,
    "",
    "## Suggested Game Plan",
    report.suggested_game_plan,
    "",
    "## Confidence Level",
    report.confidence_level,
    "",
    "## Unknowns / Data Gaps",
    ...report.unknowns_data_gaps.map((u) => `- ${u}`),
  ];

  return sections.join("\n");
}

export async function fileToDataUrl(
  file: Blob,
  fallbackMime = "image/png"
): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || fallbackMime;
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}
