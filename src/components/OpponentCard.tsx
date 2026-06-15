import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Opponent } from "@/types";
import { formatDate } from "@/lib/utils";
import { MapPin, Calendar } from "lucide-react";

interface OpponentCardProps {
  opponent: Opponent;
  uploadCount?: number;
  hasReport?: boolean;
}

export function OpponentCard({
  opponent,
  uploadCount = 0,
  hasReport = false,
}: OpponentCardProps) {
  return (
    <Link href={`/opponents/${opponent.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <CardTitle className="text-lg">{opponent.name}</CardTitle>
            <Badge variant="secondary">{opponent.age_level}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            {opponent.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {opponent.location}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Added {formatDate(opponent.created_at)}
            </div>
            <div className="flex gap-2 pt-1">
              <Badge variant="outline">{uploadCount} screenshots</Badge>
              {hasReport && <Badge variant="success">Report ready</Badge>}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
