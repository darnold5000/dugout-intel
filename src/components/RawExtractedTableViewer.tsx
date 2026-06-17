import type { RawExtractedTable } from "@/types";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface RawExtractedTableViewerProps {
  table: RawExtractedTable | null;
  warnings?: string[] | null;
  compact?: boolean;
}

export function RawExtractedTableViewer({
  table,
  warnings,
  compact = false,
}: RawExtractedTableViewerProps) {
  const [showAdvanced, setShowAdvanced] = useState(!compact);
  const hasTable =
    !!table && table.headers.length > 0 && table.rows.length > 0;

  if (!hasTable && (!warnings || warnings.length === 0)) {
    return null;
  }

  return (
    <div className="space-y-2">
      {warnings && warnings.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 space-y-1">
          {warnings.map((warning, index) => (
            <p key={index}>• {warning}</p>
          ))}
        </div>
      )}

      {hasTable && table && (
        <div className="rounded-md border bg-muted/20 p-2">
          {compact ? (
            <button
              type="button"
              className="flex w-full items-center gap-2 text-xs font-medium text-muted-foreground mb-2"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              Advanced extraction data
            </button>
          ) : (
            <p className="text-xs font-medium mb-2 text-muted-foreground">
              Advanced extraction data
            </p>
          )}

          {(!compact || showAdvanced) && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    {table.headers.map((header, index) => (
                      <th
                        key={index}
                        className="pb-1 pr-2 text-left font-medium"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b border-muted/50">
                      {table.headers.map((_, colIndex) => (
                        <td
                          key={colIndex}
                          className="py-1 pr-2 whitespace-nowrap"
                        >
                          {row[colIndex] ?? "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
