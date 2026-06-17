import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface NeedsReviewIndicatorProps {
  confidence?: number;
  needsReview?: boolean;
  hasConflict?: boolean;
  className?: string;
}

export function NeedsReviewIndicator({
  confidence = 1,
  needsReview = false,
  hasConflict = false,
  className,
}: NeedsReviewIndicatorProps) {
  const show =
    needsReview ||
    hasConflict ||
    confidence < 0.9;

  if (!show) return null;

  const label =
    confidence < 0.9 || needsReview ? "Needs review" : "Review suggested";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs text-amber-700",
        className
      )}
      title={`Confidence: ${Math.round(confidence * 100)}%`}
    >
      <AlertTriangle className="h-3 w-3 shrink-0" />
      {label}
    </span>
  );
}
