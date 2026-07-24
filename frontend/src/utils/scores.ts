export type PredictionFormat = 'score_20' | 'score_5'

/** Returns a Tailwind text-colour class based on the predicted score and format. */
export function getScoreColor(score: number, format: PredictionFormat = 'score_20'): string {
  if (format === 'score_5') {
    if (score <= 1) return 'text-danger'
    if (score <= 2) return 'text-orange-500'
    if (score <= 3) return 'text-warning'
    if (score <= 4) return 'text-lime-500'
    return 'text-success'
  }
  if (score <= 6) return 'text-danger'
  if (score <= 13) return 'text-warning'
  return 'text-success'
}
