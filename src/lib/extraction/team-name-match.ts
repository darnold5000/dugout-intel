const STOP_WORDS = new Set(["the", "and", "of", "team", "baseball", "softball"]);

export function tokenizeTeamName(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

/** Score 0–1 how well candidate matches the scouting opponent name. */
export function scoreTeamNameMatch(
  opponentName: string,
  candidateName: string
): number {
  const opponentTokens = tokenizeTeamName(opponentName);
  const candidateTokens = tokenizeTeamName(candidateName);
  if (opponentTokens.length === 0 || candidateTokens.length === 0) return 0;

  const opponentJoined = opponentTokens.join(" ");
  const candidateJoined = candidateTokens.join(" ");

  if (candidateJoined.includes(opponentJoined) || opponentJoined.includes(candidateJoined)) {
    return 1;
  }

  const opponentSet = new Set(opponentTokens);
  let overlap = 0;
  for (const token of candidateTokens) {
    if (opponentSet.has(token)) overlap++;
  }

  const precision = overlap / candidateTokens.length;
  const recall = overlap / opponentTokens.length;
  if (overlap === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

export function teamsMatch(
  opponentName: string,
  candidateName: string,
  threshold = 0.45
): boolean {
  return scoreTeamNameMatch(opponentName, candidateName) >= threshold;
}
