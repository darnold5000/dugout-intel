export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExtractionStatusBadge } from "@/components/ExtractionStatusBadge";
import {
  ArrowLeft,
  Upload,
  Database,
  FileText,
  MapPin,
} from "lucide-react";

export default async function OpponentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: opponent } = await supabase
    .from("opponents")
    .select("*")
    .eq("id", id)
    .eq("user_id", user!.id)
    .single();

  if (!opponent) notFound();

  const [
    { data: uploads },
    { data: players },
    { data: battingStats },
    { data: pitchingStats },
    { data: reports },
  ] = await Promise.all([
    supabase
      .from("screenshot_uploads")
      .select("*")
      .eq("opponent_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("extracted_players")
      .select("id")
      .eq("opponent_id", id),
    supabase
      .from("extracted_batting_stats")
      .select("id")
      .eq("opponent_id", id),
    supabase
      .from("extracted_pitching_stats")
      .select("id")
      .eq("opponent_id", id),
    supabase
      .from("scouting_reports")
      .select("*")
      .eq("opponent_id", id)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const pendingCount =
    uploads?.filter((u) => u.extraction_status === "pending").length ?? 0;
  const hasExtractedData =
    (players?.length ?? 0) +
      (battingStats?.length ?? 0) +
      (pitchingStats?.length ?? 0) >
    0;
  const latestReport = reports?.[0];

  return (
    <div className="min-h-screen bg-muted/20">
      <AppHeader userEmail={user?.email} />
      <main className="container mx-auto px-4 py-8">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/opponents">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to opponents
          </Link>
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{opponent.name}</h1>
              <Badge variant="secondary">{opponent.age_level}</Badge>
            </div>
            {opponent.location && (
              <p className="text-muted-foreground mt-1 flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {opponent.location}
              </p>
            )}
            {opponent.notes && (
              <p className="text-sm text-muted-foreground mt-2">
                {opponent.notes}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Screenshots
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{uploads?.length ?? 0}</p>
              {pendingCount > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {pendingCount} pending extraction
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Database className="h-4 w-4" />
                Extracted data
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {(players?.length ?? 0) +
                  (battingStats?.length ?? 0) +
                  (pitchingStats?.length ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">records</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Report
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {latestReport ? "Ready" : "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-3 mb-8">
          <Button asChild>
            <Link href={`/opponents/${id}/upload`}>
              <Upload className="h-4 w-4 mr-1" />
              Upload screenshots
            </Link>
          </Button>
          {hasExtractedData && (
            <Button variant="outline" asChild>
              <Link href={`/opponents/${id}/extracted-data`}>
                <Database className="h-4 w-4 mr-1" />
                Review data
              </Link>
            </Button>
          )}
          {hasExtractedData && (
            <Button variant="outline" asChild>
              <Link href={`/opponents/${id}/report`}>
                <FileText className="h-4 w-4 mr-1" />
                {latestReport ? "View report" : "Generate report"}
              </Link>
            </Button>
          )}
        </div>

        {uploads && uploads.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent uploads</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {uploads.slice(0, 5).map((upload) => (
                  <div
                    key={upload.id}
                    className="flex items-center justify-between text-sm py-2 border-b last:border-0"
                  >
                    <span className="text-muted-foreground truncate max-w-[200px]">
                      {upload.screenshot_type?.replace("_", " ") ?? "Unknown type"}
                    </span>
                    <ExtractionStatusBadge status={upload.extraction_status} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
