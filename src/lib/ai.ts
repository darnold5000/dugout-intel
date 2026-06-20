import OpenAI from "openai";
import { enrichExtractionResult } from "@/lib/extraction/post-process";
import type { EvidencePacket } from "@/lib/scouting/evidence-packet";
import {
  buildTeamIntelligence,
  formatIntelligenceReportText,
  intelligenceToReportJson,
} from "@/lib/scouting/team-intelligence";
import type { AIExtractionResult, OpponentDetail } from "@/types";

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const EXTRACTION_SYSTEM_PROMPT = `You are a youth baseball data extraction assistant specializing in stat screenshots from mobile scorekeeping apps.

PRIMARY TASK:
Treat every screenshot as a TABLE whenever rows and columns are visible. Extract ALL visible column headers exactly as shown, then extract every row of values beneath them.

CRITICAL RULES:
- Do NOT stop at player names. If stat columns are visible, extract every value for every player row.
- Never invent missing stats or player information.
- Return null for unreadable cells, but still include the row if the player name is visible.
- Preserve numeric strings exactly as shown (examples: ".429", "0.429", "1.125", "12", "12.1").
- Decimal batting averages often appear without a leading zero — keep them as numeric values (example: ".429" -> 0.429).
- Mark uncertain values with lower confidence (0.0-1.0).
- Preserve jersey numbers exactly when visible.
- Include warnings when:
  - screenshot is cropped
  - columns are too small or blurry
  - only names are readable
  - table headers are missing
- Include unknowns for data you cannot determine.

SCREENSHOT TYPE CLASSIFIER (screenshot_type):
- roster
- batting_stats
- pitching_stats
- schedule_results
- box_score
- bracket_tournament
- unknown

BATTING COLUMNS TO RECOGNIZE:
AVG, OBP, OPS, PA, AB, R, H, 1B, 2B, 3B, HR, RBI, BB, SO, HBP, SB, CS

Map these into batting_stats when visible:
- AVG -> avg
- OBP -> obp
- OPS -> ops
- H -> hits
- R -> runs
- RBI -> rbi
- BB -> walks
- SO or K -> strikeouts
- SB -> stolen_bases

PITCHING STANDARD COLUMNS:
IP, BF, P, S, S%, ERA, WHIP, BB, SO, K, H, BAA

BOX SCORE PITCHING (CRITICAL):
Box score pitching tables show IP, H, R, ER, BB, SO per pitcher.
Below the table, apps often show supplemental footer lines:
- "Pitches-Strikes" with values like "39-24 Waylon W" (total pitches and strikes per pitcher)
- "Batters Faced" with values like "10 Waylon W"
Extract these into pitching_stats: total_pitches, strikes, batters_faced for each named pitcher.
Also include footer lines in raw_extracted_table rows when visible.
Set screenshot_type to box_score when this layout is detected.

PITCHING ADVANCED COLUMNS:
FPS%, K/BB, BB/INN, P/IP, P/BF, 123INN, LOO, SM%, FIP, BABIP

Map into pitching_stats when visible:
- IP -> innings_pitched
- BF -> batters_faced
- P -> total_pitches (also set pitches to same value)
- S -> strikes
- S% -> strike_percentage (store as percentage points, e.g. 65% -> 65)
- FPS% -> first_pitch_strike_pct (percentage points, e.g. 67.2% -> 67.2)
- ERA -> era
- BB -> walks
- SO or K -> strikeouts
- H -> hits_allowed
- R -> runs_allowed
- ER -> earned_runs
- BAA -> baa (decimal, e.g. .278 -> 0.278)
- K/BB -> k_bb_ratio
- BB/INN -> walks_per_inning
- P/IP -> pitches_per_inning
- P/BF -> pitches_per_batter_faced
- 123INN -> one_two_three_innings
- LOO -> leadoff_outs
- SM% -> swing_miss_pct (percentage points)
- BABIP -> babip
- FIP -> fip

TABLE EXTRACTION:
Always populate raw_extracted_table when any tabular data is visible:
{
  "headers": ["exact", "column", "headers"],
  "rows": [["row1col1", "row1col2"], ["row2col1", "row2col2"]]
}

SCHEDULE / RESULTS SCREENS (CRITICAL):
Schedule and results views are often vertical LISTS, not stat tables.
- Set screenshot_type to schedule_results when you see past/upcoming games with opponents, dates, and scores.
- Populate games with one object per visible game row (opponent_name, game_date as YYYY-MM-DD when possible, result W/L/T, runs_for, runs_against).
- For schedule_results or box_score screenshots, an empty raw_extracted_table is OK when games are populated.
- Do NOT return screenshot_type unknown for a readable schedule/results list.
- Do NOT warn "screenshot does not contain tabular data" when games were extracted from a schedule view.

DUAL-TEAM SCREENSHOTS (CRITICAL):
Box scores and stat screens often show TWO teams (side-by-side columns or stacked sections).
When an opponent team name is provided in the user message, extract ONLY that opponent's players and stats.
Set team_name to the scouting opponent name.
Do NOT mix players or stats from the other team into batting_stats, pitching_stats, or players.
In raw_extracted_table, include only rows for the scouting opponent (plus their pitching footer lines).

Return ONLY valid JSON matching this schema:
{
  "screenshot_type": "roster | batting_stats | pitching_stats | schedule_results | box_score | unknown",
  "team_name": string | null,
  "raw_extracted_table": { "headers": string[], "rows": string[][] },
  "players": [{ "name": string | null, "jersey_number": string | null, "positions": string[] | null, "confidence": number }],
  "batting_stats": [{ "player_name": string | null, "jersey_number": string | null, "avg": number | null, "obp": number | null, "ops": number | null, "hits": number | null, "walks": number | null, "strikeouts": number | null, "rbi": number | null, "runs": number | null, "stolen_bases": number | null, "confidence": number }],
  "pitching_stats": [{ "player_name": string | null, "jersey_number": string | null, "innings_pitched": number | null, "pitches": number | null, "total_pitches": number | null, "batters_faced": number | null, "strikes": number | null, "strike_percentage": number | null, "first_pitch_strike_pct": number | null, "era": number | null, "walks": number | null, "strikeouts": number | null, "hits_allowed": number | null, "runs_allowed": number | null, "earned_runs": number | null, "k_bb_ratio": number | null, "walks_per_inning": number | null, "pitches_per_inning": number | null, "pitches_per_batter_faced": number | null, "one_two_three_innings": number | null, "leadoff_outs": number | null, "swing_miss_pct": number | null, "baa": number | null, "babip": number | null, "fip": number | null, "confidence": number }],
  "games": [{ "opponent_name": string | null, "game_date": string | null, "result": string | null, "runs_for": number | null, "runs_against": number | null, "notes": string | null, "confidence": number }],
  "warnings": string[],
  "unknowns": string[]
}`;

const REPORT_NARRATIVE_PROMPT = `You are a youth baseball scouting assistant writing reports for coaches of 9U-12U travel ball teams.

SCOUTING REPORT PERSPECTIVE RULE (CRITICAL):
- All reports are written for the SCOUTING TEAM (our team).
- The opponent is the team being analyzed (them).
- Every recommendation must answer: "What should OUR team do against THEM?"
- Write assessments about the opponent; write game plans for our coaches and players.
- Never generate recommendations from the opponent's perspective.
- BAD: "Pitch Carson in the 5th inning" or "Have Maverick bunt more often."
- GOOD: "Attack their secondary pitchers after the 4th" or "Pitch around #44 Maverick W."

You will receive PRE-COMPUTED scouting intelligence with verified stats and player rankings, plus a full evidence packet (screenshots, coach notes, voice transcripts, documents, game context). Your job is to write compelling narrative prose that references specific players and stats from the data.

Write in plain English, coach-friendly tone. Be practical and actionable.

CRITICAL RULES:
- Use ALL evidence provided: structured intelligence, screenshots/raw tables, coach notes, voice transcripts, documents, and game context.
- Clearly distinguish CONFIRMED DATA (from stats/screenshots) from NOTE-BASED INFERENCE (from coach notes/voice).
- Label inferences explicitly: "Note-based inference: ..."
- Reference opponent players by name AND jersey number when available.
- For pitching: analyze pitch counts, strikes, balls, strike %, innings pitched, and pitcher roles.
- Use the pre-computed pitching staff analysis when provided.
- Weight scout notes by the \`weight\` field (1-5). Championship/bracket and pitching box scores are highest weight; pool play is lower.
- Baseball innings: 2.1 IP = 2 and 1/3 innings, NOT 2.1 decimal innings.
- Do NOT invent stats. Do NOT contradict the structured intelligence.
- suggested_game_plan must be advice TO our coaching staff about how to beat the opponent.
- offensive_tendencies and pitching_notes describe what OUR team will face — not advice to the opponent.
- Use "our hitters", "our pitching", "our defense" when giving approach advice.
- Player cards in the intelligence data use "How To Attack" — follow that framing for per-player advice.

Return ONLY valid JSON:
{
  "opponent_summary": string (2-3 sentences describing the opponent — not advice to them),
  "offensive_tendencies": string (what our team should expect from their offense),
  "pitching_notes": string (what our team should expect from their pitching staff),
  "suggested_game_plan": string (what OUR team should do — actionable pre-game plan in 3-5 bullet points as prose)
}`;

export interface ExtractScreenshotOptions {
  opponentName?: string | null;
}

function buildExtractionUserPrompt(opponentName?: string | null): string {
  const base =
    "Extract all baseball data from this screenshot. If this is a stat table, capture exact column headers in raw_extracted_table and map rows into batting_stats or pitching_stats. If this is a schedule/results list, set screenshot_type to schedule_results and populate the games array (opponent, date, W/L, score). Return structured JSON only.";

  const trimmed = opponentName?.trim();
  if (!trimmed) return base;

  return `${base}

OPPONENT TEAM FILTER (CRITICAL):
You are extracting data for the scouting opponent: "${trimmed}"
When this screenshot shows two teams, extract ONLY players and stats for "${trimmed}".
Set team_name to "${trimmed}".
Do NOT include batting_stats, pitching_stats, or players from the other team.
In raw_extracted_table, include only the table section and footer lines for "${trimmed}".`;
}

export async function extractFromScreenshot(
  imageDataUrl: string,
  options?: ExtractScreenshotOptions
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
              text: buildExtractionUserPrompt(options?.opponentName),
            },
            {
              type: "image_url",
              image_url: { url: imageDataUrl, detail: "high" },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 8192,
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

  let parsed: AIExtractionResult;
  try {
    parsed = JSON.parse(content) as AIExtractionResult;
  } catch {
    throw new Error("Failed to parse OpenAI extraction JSON response");
  }

  parsed.raw_extracted_table = parsed.raw_extracted_table ?? {
    headers: [],
    rows: [],
  };

  const enriched = enrichExtractionResult(parsed, {
    opponentName: options?.opponentName,
  });
  if (!isEmptyExtraction(enriched)) {
    return enriched;
  }

  return extractScheduleFromScreenshot(
    imageDataUrl,
    enriched.warnings,
    options?.opponentName
  );
}

const SCHEDULE_EXTRACTION_PROMPT = `You extract game results from schedule or results screenshots.

These screens show a vertical list of games — NOT a batting/pitching stat table.
Each row typically has: date, opponent team name, W/L result, and score (runs for / runs against).

Return ONLY valid JSON:
{
  "screenshot_type": "schedule_results",
  "team_name": string | null,
  "raw_extracted_table": { "headers": [], "rows": [] },
  "players": [],
  "batting_stats": [],
  "pitching_stats": [],
  "games": [{ "opponent_name": string | null, "game_date": string | null, "result": string | null, "runs_for": number | null, "runs_against": number | null, "notes": string | null, "confidence": number }],
  "warnings": string[],
  "unknowns": string[]
}

Extract every visible completed game. Use ISO dates (YYYY-MM-DD) when readable.`;

function isEmptyExtraction(extraction: AIExtractionResult): boolean {
  const table = extraction.raw_extracted_table;
  const hasTable = (table?.headers?.length ?? 0) > 0 || (table?.rows?.length ?? 0) > 0;
  return (
    !hasTable &&
    extraction.players.length === 0 &&
    extraction.batting_stats.length === 0 &&
    extraction.pitching_stats.length === 0 &&
    extraction.games.length === 0
  );
}

async function extractScheduleFromScreenshot(
  imageDataUrl: string,
  priorWarnings: string[] = [],
  opponentName?: string | null
): Promise<AIExtractionResult> {
  const enrichOpts = { opponentName };
  let response;
  try {
    response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SCHEDULE_EXTRACTION_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "This screenshot may be a schedule or results list. Extract every visible game into the games array.",
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
  } catch {
    return enrichExtractionResult({
      screenshot_type: "unknown",
      team_name: null,
      raw_extracted_table: { headers: [], rows: [] },
      players: [],
      batting_stats: [],
      pitching_stats: [],
      games: [],
      warnings: priorWarnings,
      unknowns: [],
    }, enrichOpts);
  }

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return enrichExtractionResult({
      screenshot_type: "unknown",
      team_name: null,
      raw_extracted_table: { headers: [], rows: [] },
      players: [],
      batting_stats: [],
      pitching_stats: [],
      games: [],
      warnings: priorWarnings,
      unknowns: [],
    }, enrichOpts);
  }

  let parsed: AIExtractionResult;
  try {
    parsed = JSON.parse(content) as AIExtractionResult;
  } catch {
    return enrichExtractionResult({
      screenshot_type: "unknown",
      team_name: null,
      raw_extracted_table: { headers: [], rows: [] },
      players: [],
      batting_stats: [],
      pitching_stats: [],
      games: [],
      warnings: priorWarnings,
      unknowns: [],
    }, enrichOpts);
  }

  parsed.raw_extracted_table = parsed.raw_extracted_table ?? {
    headers: [],
    rows: [],
  };
  parsed.screenshot_type = "schedule_results";
  parsed.warnings = [...priorWarnings, ...(parsed.warnings ?? [])];

  return enrichExtractionResult(parsed, enrichOpts);
}

export async function generateScoutingReport(data: {
  opponentName: string;
  ageLevel: string;
  opponentDetail: OpponentDetail;
  evidencePacket: EvidencePacket;
}): Promise<{ reportJson: import("@/types").ScoutingReportJson; reportText: string }> {
  const intelligence = buildTeamIntelligence(data.opponentDetail);

  let aiNarrative: Partial<{
    opponent_summary: string;
    offensive_tendencies: string;
    pitching_notes: string;
    suggested_game_plan: string;
  }> = {};

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: REPORT_NARRATIVE_PROMPT },
        {
          role: "user",
          content: `Write narrative sections for opponent "${data.opponentName}" (${data.ageLevel}).

Structured scouting intelligence (use these facts, cite player names):
${JSON.stringify(
  {
    team_identity: intelligence.teamIdentity,
    offensive_leaders: intelligence.offensiveLeaders,
    pitching_leaders: intelligence.pitchingLeaders,
    base_running_threats: intelligence.baseRunningThreats,
    lineup_tiers: intelligence.lineupThreatTiers,
    pitching_hierarchy: intelligence.pitchingHierarchy,
    player_cards: intelligence.playerScoutingCards,
    players_to_attack: intelligence.playersToAttack.map((p) => p.player_name),
    players_to_avoid: intelligence.playersToAvoid.map((p) => p.player_name),
  },
  null,
  2
)}

Full evidence packet (screenshots, notes, voice transcripts, documents, game context, consolidated stats, and pitching analysis):
${JSON.stringify(data.evidencePacket, null, 2)}

Write practical advice for a youth baseball coach preparing to play this team.`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 4096,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      aiNarrative = JSON.parse(content) as typeof aiNarrative;
    }
  } catch {
    // Fall back to rule-based narratives if AI unavailable
  }

  const reportJson = intelligenceToReportJson(intelligence, aiNarrative, {
    pitchingStaffBreakdown: data.evidencePacket.pitchingStaffRead,
    pitcherUsageContext: data.evidencePacket.tournamentPitchingRead,
  });
  const reportText = formatIntelligenceReportText(data.opponentName, reportJson);

  return { reportJson, reportText };
}

export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const file = new File([Uint8Array.from(audioBuffer)], "voice-note.webm", {
    type: mimeType,
  });
  const transcription = await getOpenAI().audio.transcriptions.create({
    file,
    model: "whisper-1",
    language: "en",
  });
  return transcription.text.trim();
}

export async function extractDocumentText(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "txt" || ext === "csv" || mimeType.startsWith("text/")) {
    return buffer.toString("utf-8").trim();
  }

  if (mimeType.startsWith("image/")) {
    const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all readable text and tabular data from this document image. Return plain text only.",
            },
            { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
          ],
        },
      ],
      max_tokens: 4096,
    });
    return response.choices[0]?.message?.content?.trim() ?? "";
  }

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: `A document named "${fileName}" was uploaded. Based on the filename and type (${mimeType}), provide a brief note that the document was uploaded. If this appears to be a tournament bracket, schedule, or roster document, note what type it likely is.`,
      },
    ],
    max_tokens: 500,
  });
  return (
    response.choices[0]?.message?.content?.trim() ??
    `Uploaded document: ${fileName}`
  );
}

export async function fileToDataUrl(
  file: Blob,
  fallbackMime = "image/png"
): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || fallbackMime;
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}
