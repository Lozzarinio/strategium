/** Returns a Tailwind text-colour class based on the predicted score (0–20). */
export function getScoreColor(score: number): string {
  if (score <= 6) return 'text-danger'   // 0–6:   red
  if (score <= 13) return 'text-warning' // 7–13:  amber
  return 'text-success'                  // 14–20: green
}
