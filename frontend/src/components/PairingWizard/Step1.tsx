import type { WizardHook } from '../../hooks/useWizardState'
import RecommendationCard from './RecommendationCard'

interface Props {
  wizard: WizardHook
  yourPlayers: string[]
}

export default function Step1({ wizard, yourPlayers }: Props) {
  const { state, setR1Defender, confirmR1Defender, getR1DefenderOptions } = wizard
  const options = getR1DefenderOptions()
  const recommended = options.find(o => o.is_recommended)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Step 1 — Select Your Defender</h2>
        <p className="text-sm text-muted">
          The defender plays in Round 1 and does not enter Round 2. Pick based on the optimizer's maximin recommendation.
        </p>
      </div>

      {recommended && (
        <RecommendationCard
          label="Optimizer recommends"
          recommended={recommended.player}
          worstCase={recommended.worst_case_total}
          bestCase={recommended.best_case_total}
        />
      )}

      <div className="space-y-2">
        {yourPlayers.map(player => {
          const opt = options.find(o => o.player === player)
          const isRec = opt?.is_recommended ?? false
          const isSelected = state.r1Defender === player

          return (
            <button
              key={player}
              onClick={() => setR1Defender(player)}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border
                transition-all text-left
                ${isSelected
                  ? 'bg-accent/20 border-accent text-white'
                  : 'bg-black/20 border-white/10 text-muted hover:border-white/30 hover:text-white'
                }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0
                    ${isSelected ? 'border-accent bg-accent' : 'border-white/20'}`}
                >
                  {isSelected && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
                <span className="font-medium">{player}</span>
                {isRec && (
                  <span className="text-xs bg-accent/20 text-accent border border-accent/30 rounded-full px-2 py-0.5">
                    Recommended
                  </span>
                )}
              </div>
              {opt && (
                <div className="text-right text-xs text-muted/60">
                  <span className="text-white/60 font-mono">{opt.worst_case_total}</span>
                  <span className="mx-1">–</span>
                  <span className="text-white/60 font-mono">{opt.best_case_total}</span>
                  <span className="ml-1">pts</span>
                </div>
              )}
            </button>
          )
        })}
      </div>

      <button
        onClick={confirmR1Defender}
        disabled={!state.r1Defender}
        className="w-full py-3 bg-accent hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed
          text-white font-semibold rounded-xl transition-all"
      >
        Confirm Defender{state.r1Defender ? ` — ${state.r1Defender}` : ''}
      </button>
    </div>
  )
}
