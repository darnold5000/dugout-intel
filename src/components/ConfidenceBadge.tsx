import { NeedsReviewIndicator } from "@/components/NeedsReviewIndicator";

interface ConfidenceBadgeProps {
  confidence: number;
  needsReview?: boolean;
  hasConflict?: boolean;
  forceShow?: boolean;
  className?: string;
}

/** Only surfaces confidence when there is a problem worth reviewing. */
export function ConfidenceBadge({
  confidence,
  needsReview = false,
  hasConflict = false,
  forceShow = false,
  className,
}: ConfidenceBadgeProps) {
  if (confidence >= 0.95 && !needsReview && !hasConflict && !forceShow) {
    return null;
  }

  return (
    <NeedsReviewIndicator
      confidence={confidence}
      needsReview={needsReview || confidence < 0.9}
      hasConflict={hasConflict}
      className={className}
    />
  );
}
