import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ConfidenceBadgeProps {
  confidence: number;
  className?: string;
}

export function ConfidenceBadge({ confidence, className }: ConfidenceBadgeProps) {
  const pct = Math.round(confidence * 100);
  const variant =
    pct >= 80 ? "success" : pct >= 50 ? "warning" : "destructive";

  return (
    <Badge variant={variant} className={cn(className)}>
      {pct}% confidence
    </Badge>
  );
}
