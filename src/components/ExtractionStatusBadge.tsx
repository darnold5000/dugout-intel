import { Badge } from "@/components/ui/badge";
import type { ExtractionStatus } from "@/types";

const statusConfig: Record<
  ExtractionStatus,
  { label: string; variant: "pending" | "warning" | "success" | "destructive" }
> = {
  pending: { label: "Pending", variant: "pending" },
  processing: { label: "Processing", variant: "warning" },
  complete: { label: "Complete", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
};

interface ExtractionStatusBadgeProps {
  status: ExtractionStatus;
}

export function ExtractionStatusBadge({ status }: ExtractionStatusBadgeProps) {
  const config = statusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
