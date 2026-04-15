interface Props {
  label: string
  recommended: string
  worstCase: number
  bestCase: number
  isDeviation?: boolean
}

export default function RecommendationCard({
  label,
  recommended,
  worstCase,
  bestCase,
  isDeviation = false,
}: Props) {
  return (
    <div
      className={`rounded-xl p-4 border ${
        isDeviation
          ? 'bg-warning/10 border-warning/30'
          : 'bg-accent/10 border-accent/30'
      }`}
    >
      <p className={`text-xs uppercase tracking-wide mb-1 ${isDeviation ? 'text-warning/70' : 'text-accent/70'}`}>
        {isDeviation ? '⚠ Deviation from' : '★'} {label}
      </p>
      <p className={`text-lg font-bold ${isDeviation ? 'text-warning' : 'text-accent'}`}>
        {recommended}
      </p>
      <div className="flex gap-3 mt-2 text-xs text-muted/70">
        <span>Worst: <span className="text-white font-mono">{worstCase}</span></span>
        <span>Best: <span className="text-white font-mono">{bestCase}</span></span>
      </div>
    </div>
  )
}
