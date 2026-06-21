"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getAuthHeaders } from "@/lib/auth-headers";
import { RefreshCw } from "lucide-react";

interface RebuildStatsButtonProps {
  opponentId: string;
  onComplete: () => Promise<void>;
  variant?: "default" | "outline";
  size?: "default" | "sm" | "lg";
  className?: string;
  showDiagnostics?: boolean;
  onDiagnostics?: (message: string) => void;
  label?: string;
}

export function RebuildStatsButton({
  opponentId,
  onComplete,
  variant = "outline",
  size = "sm",
  className,
  showDiagnostics = false,
  onDiagnostics,
  label = "Rebuild Stats From Screenshots",
}: RebuildStatsButtonProps) {
  const [rebuilding, setRebuilding] = useState(false);
  const [message, setMessage] = useState("");

  const handleRebuild = async () => {
    setRebuilding(true);
    setMessage("");
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`/api/opponents/${opponentId}/rebuild-stats`, {
        method: "POST",
        headers: authHeaders,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Rebuild failed");

      const dupNote =
        body.duplicate_player_count > 0
          ? ` · ${body.duplicate_player_count} potential duplicate group(s) flagged`
          : " · 0 duplicate players";

      const summary = `Rebuilt: ${body.counts.players} players, ${body.counts.batting_stats} batting, ${body.counts.pitching_stats} pitching${dupNote}`;
      setMessage(summary);
      onDiagnostics?.(summary);

      if (showDiagnostics && body.merge_diagnostics?.length) {
        console.log("[merge diagnostics]", body.merge_diagnostics);
      }
      if (showDiagnostics && body.potential_duplicates?.length) {
        console.log("[potential duplicates]", body.potential_duplicates);
      }

      await onComplete();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Rebuild failed";
      setMessage(errMsg);
      onDiagnostics?.(errMsg);
    } finally {
      setRebuilding(false);
    }
  };

  return (
    <div className={className}>
      <Button
        variant={variant}
        size={size}
        onClick={handleRebuild}
        disabled={rebuilding}
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${rebuilding ? "animate-spin" : ""}`} />
        {rebuilding ? "Refreshing..." : label}
      </Button>
      {message && (
        <p className="text-xs text-muted-foreground mt-2">{message}</p>
      )}
    </div>
  );
}
