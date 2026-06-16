import type { RawExtractedTable } from "@/types";

interface RawExtractedTableViewerProps {
  table: RawExtractedTable | null;
  warnings?: string[] | null;
}

export function RawExtractedTableViewer({
  table,
  warnings,
}: RawExtractedTableViewerProps) {
  const hasTable =
    !!table && table.headers.length > 0 && table.rows.length > 0;

  if (!hasTable && (!warnings || warnings.length === 0)) {
    return null;
  }

  return (
    <div className="space-y-2">
      {warnings && warnings.length > 0 && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-2 text-xs text-yellow-900 space-y-1">
          {warnings.map((warning, index) => (
            <p key={index}>• {warning}</p>
          ))}
        </div>
      )}

      {hasTable && table && (
        <div className="rounded-md border bg-muted/20 p-2">
          <p className="text-xs font-medium mb-2 text-muted-foreground">
            Raw extracted table (debug)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  {table.headers.map((header, index) => (
                    <th key={index} className="pb-1 pr-2 text-left font-medium">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-b border-muted/50">
                    {table.headers.map((_, colIndex) => (
                      <td key={colIndex} className="py-1 pr-2 whitespace-nowrap">
                        {row[colIndex] ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
