import type { StatLegendTerm } from "@/lib/stat-legend";

interface StatsLegendProps {
  terms: StatLegendTerm[];
  className?: string;
}

export function StatsLegend({ terms, className }: StatsLegendProps) {
  if (terms.length === 0) return null;

  return (
    <div
      className={`rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground ${className ?? ""}`}
    >
      <p className="font-medium text-foreground mb-1.5">Stat key</p>
      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1">
        {terms.map((term) => (
          <div key={term.abbr} className="flex gap-2">
            <dt className="font-medium text-foreground shrink-0 w-14">
              {term.abbr}
            </dt>
            <dd>{term.meaning}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
