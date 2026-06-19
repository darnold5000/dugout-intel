export interface RecapObservation {
  category: "offense" | "pitching" | "defense" | "baserunning" | "momentum";
  text: string;
}

const RECAP_MARKERS =
  /gamechanger recap|inning recap|scoring play|relieved|entered the game|stole (?:second|third|home)|rbi|double play|error on|walked|struck out|home run|triple|double/i;

export function isGameChangerRecap(text: string): boolean {
  return RECAP_MARKERS.test(text);
}

export function extractRecapObservations(text: string): RecapObservation[] {
  const observations: RecapObservation[] = [];
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    if (/stole|steals|aggressive on the bases|baserunning/.test(lower)) {
      observations.push({ category: "baserunning", text: sentence });
    } else if (/error|double play|fielding|misplay/.test(lower)) {
      observations.push({ category: "defense", text: sentence });
    } else if (
      /reliev|entered|pitch|walked|struck out|struggled|ace|closer/.test(lower)
    ) {
      observations.push({ category: "pitching", text: sentence });
    } else if (/rbi|home run|triple|double|hit|scored/.test(lower)) {
      observations.push({ category: "offense", text: sentence });
    } else if (/momentum|rally|comeback|big inning/.test(lower)) {
      observations.push({ category: "momentum", text: sentence });
    }
  }

  return observations;
}

export function inferNoteTypeFromText(text: string): string {
  if (isGameChangerRecap(text)) return "gamechanger_recap";
  if (/pitch|relief|innings pitched|walked|struck out/i.test(text)) return "pitching";
  if (/hit|rbi|at bat|lineup/i.test(text)) return "hitting";
  if (/stole|steals|baserunning/i.test(text)) return "baserunning";
  if (/error|defense|fielding/i.test(text)) return "defense";
  if (/bracket|championship|tournament|pool play/i.test(text)) return "tournament_context";
  return "general";
}
