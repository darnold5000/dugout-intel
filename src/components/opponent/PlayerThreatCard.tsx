import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PlayerProfile } from "@/lib/scouting/player-profiles";

function formatStatAvg(value: number | null | undefined): string | null {
  if (value == null) return null;
  const s = value.toFixed(3);
  return s.startsWith("0.") ? s.slice(1) : s;
}

interface PlayerThreatCardProps {
  profile: PlayerProfile;
  tier?: 1 | 2 | 3 | null;
}

export function PlayerThreatCard({ profile, tier }: PlayerThreatCardProps) {
  const b = profile.batting;
  const jersey = profile.jerseyNumber ? `#${profile.jerseyNumber}` : null;
  const name = profile.name ?? "Unknown";

  const statLines: string[] = [];
  const avg = formatStatAvg(b?.avg);
  if (avg) statLines.push(`AVG ${avg}`);
  const ops = formatStatAvg(b?.ops);
  if (ops) statLines.push(`OPS ${ops}`);
  if (b?.hits != null) statLines.push(`H ${b.hits}`);
  if (b?.rbi != null) statLines.push(`RBI ${b.rbi}`);
  if (b?.stolen_bases != null) statLines.push(`SB ${b.stolen_bases}`);

  const tierLabel =
    tier === 1 ? "Tier 1 Threat" : tier === 2 ? "Tier 2 Threat" : tier === 3 ? "Tier 3" : null;

  return (
    <Card className="h-full">
      <CardContent className="pt-4 pb-4 space-y-2">
        <div>
          {jersey && <p className="text-lg font-bold leading-tight">{jersey}</p>}
          <p className="font-semibold text-sm">{name}</p>
        </div>
        {statLines.length > 0 ? (
          <div className="space-y-0.5">
            {statLines.map((line) => (
              <p key={line} className="text-sm text-muted-foreground">
                {line}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Roster only</p>
        )}
        {tierLabel && (
          <Badge variant={tier === 1 ? "default" : "secondary"} className="text-xs">
            {tierLabel}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
