import { NextResponse } from "next/server";
import { getSupabaseFromRequest } from "@/lib/supabase/request";
import { extractFromScreenshot, fileToDataUrl } from "@/lib/ai";
import { normalizeScreenshotType } from "@/lib/extraction/post-process";
import { rebuildOpponentStats } from "@/lib/extraction/rebuild-opponent-stats";
import type { AIExtractionResult, ExtractionResult } from "@/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: opponentId } = await params;
  const supabase = await getSupabaseFromRequest(request);

  console.log(
    "[extract] OPENAI_API_KEY configured:",
    !!process.env.OPENAI_API_KEY
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  console.log(
    "[extract] user verified:",
    !!user,
    user ? `id=${user.id}` : authError?.message ?? "no user"
  );

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: opponent } = await supabase
    .from("opponents")
    .select("id")
    .eq("id", opponentId)
    .eq("user_id", user.id)
    .single();

  if (!opponent) {
    return NextResponse.json({ error: "Opponent not found" }, { status: 404 });
  }

  let uploadIds: string[] | null = null;
  try {
    const body = await request.json().catch(() => ({}));
    if (body.upload_ids && Array.isArray(body.upload_ids)) {
      uploadIds = body.upload_ids;
    }
  } catch {
    // empty body is fine
  }

  let query = supabase
    .from("screenshot_uploads")
    .select("*")
    .eq("opponent_id", opponentId);

  if (uploadIds?.length) {
    query = query.in("id", uploadIds);
  } else {
    query = query.in("extraction_status", ["pending", "failed"]);
  }

  const { data: uploads, error: fetchError } = await query;

  if (fetchError) {
    console.log("[extract] fetch uploads error:", fetchError.message);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!uploads || uploads.length === 0) {
    return NextResponse.json(
      { error: "No screenshots available for extraction" },
      { status: 400 }
    );
  }

  const results: ExtractionResult[] = [];
  const freshExtractions = new Map<string, AIExtractionResult>();
  let anyFailed = false;

  for (const upload of uploads) {
    console.log("[extract] processing upload:", upload.id, upload.file_path);

    await supabase
      .from("screenshot_uploads")
      .update({ extraction_status: "processing", extraction_error: null })
      .eq("id", upload.id);

    try {
      const { data: fileBlob, error: downloadError } = await supabase.storage
        .from("gamechanger-screenshots")
        .download(upload.file_path);

      if (downloadError || !fileBlob) {
        throw new Error(
          downloadError?.message ?? "Failed to download screenshot from storage"
        );
      }

      const imageDataUrl = await fileToDataUrl(fileBlob);
      const extraction = await extractFromScreenshot(imageDataUrl);

      freshExtractions.set(upload.id, extraction);

      const counts = {
        players: extraction.players.length,
        batting_stats: extraction.batting_stats.length,
        pitching_stats: extraction.pitching_stats.length,
        games: extraction.games.length,
      };

      console.log("[extract] extracted counts:", upload.id, counts);

      await supabase
        .from("screenshot_uploads")
        .update({
          extraction_status: "complete",
          screenshot_type: normalizeScreenshotType(extraction.screenshot_type),
          extraction_error: null,
          raw_extracted_table: extraction.raw_extracted_table,
          extraction_warnings: extraction.warnings,
        })
        .eq("id", upload.id);

      results.push({
        upload_id: upload.id,
        status: "complete",
        screenshot_type: extraction.screenshot_type,
        counts,
        raw_extracted_table: extraction.raw_extracted_table,
        warnings: extraction.warnings,
        unknowns: extraction.unknowns,
      });
    } catch (err) {
      anyFailed = true;
      const errorMessage =
        err instanceof Error ? err.message : "Extraction failed";

      console.log("[extract] failed:", upload.id, errorMessage);

      await supabase
        .from("screenshot_uploads")
        .update({
          extraction_status: "failed",
          extraction_error: errorMessage,
        })
        .eq("id", upload.id);

      results.push({
        upload_id: upload.id,
        status: "failed",
        error: errorMessage,
      });
    }
  }

  let consolidatedCounts = {
    players: 0,
    batting_stats: 0,
    pitching_stats: 0,
    games: 0,
  };
  let consolidateWarnings: string[] = [];

  if (freshExtractions.size > 0) {
    try {
      const rebuilt = await rebuildOpponentStats(
        supabase,
        opponentId,
        freshExtractions
      );
      consolidatedCounts = rebuilt.counts;
      consolidateWarnings = rebuilt.warnings;
      console.log("[extract] consolidated counts:", consolidatedCounts);
    } catch (err) {
      anyFailed = true;
      const errorMessage =
        err instanceof Error ? err.message : "Failed to consolidate stats";
      console.log("[extract] consolidate failed:", errorMessage);
      return NextResponse.json(
        { error: errorMessage, results, success: false },
        { status: 500 }
      );
    }
  }

  const responseBody = {
    results,
    totals: consolidatedCounts,
    consolidate_warnings: consolidateWarnings,
    success: !anyFailed,
  };

  if (anyFailed) {
    return NextResponse.json(responseBody, { status: 500 });
  }

  return NextResponse.json(responseBody);
}
