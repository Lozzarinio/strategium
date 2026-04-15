import { Link, useParams } from 'react-router-dom'
import type { WizardHook } from '../../hooks/useWizardState'
import type { OptimizationResult } from '../../types/optimization'

interface Props {
  wizard: WizardHook
  optimizationResult: OptimizationResult
}

export default function Step8({ wizard, optimizationResult }: Props) {
  const { id, roundId } = useParams()
  const { allRecordedPairings, runningTotal, state } = wizard

  // Best possible score from optimizer (recommended defender's best case)
  const bestPossible = optimizationResult.round_1.defender_options.find(
    d => d.is_recommended
  )?.best_case_total ?? 0

  const allPairings = allRecordedPairings  // includes finalPairing

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Step 8 — Final Summary</h2>
        <p className="text-sm text-muted">
          All 5 pairings are confirmed. Review and save the completed pairings.
        </p>
      </div>

      {/* Score summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-black/40 rounded-xl p-4 border border-accent/30">
          <p className="text-xs text-muted/70 uppercase tracking-wide mb-1">Total Predicted Score</p>
          <p className="text-3xl font-bold text-accent font-mono">{runningTotal}</p>
          <p className="text-xs text-muted/60 mt-0.5">pts across 5 games</p>
        </div>
        <div className="bg-black/40 rounded-xl p-4 border border-white/10">
          <p className="text-xs text-muted/70 uppercase tracking-wide mb-1">Optimizer Best Case</p>
          <p className="text-3xl font-bold text-white font-mono">{bestPossible}</p>
          <p className="text-xs text-muted/60 mt-0.5">
            {runningTotal >= bestPossible * 0.9
              ? '✓ Close to optimal'
              : 'Below optimal — pairing deviated'}
          </p>
        </div>
      </div>

      {/* All 5 pairings */}
      <div className="bg-black/30 rounded-xl border border-white/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10">
          <p className="text-sm font-semibold text-white">All Pairings</p>
        </div>
        <div className="divide-y divide-white/5">
          {allPairings.map((p, i) => {
            const isAutomatic = i === 4
            return (
              <div key={i} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted/40 font-mono w-4">G{i + 1}</span>
                  <span className="text-sm text-white">
                    {p.your_player}
                    <span className="text-muted mx-2">vs</span>
                    {p.opponent_player}
                  </span>
                  {isAutomatic && (
                    <span className="text-xs text-muted/60 border border-white/10 rounded-full px-2 py-0.5">
                      auto
                    </span>
                  )}
                </div>
                <span className="text-sm font-mono font-bold text-white">{p.predicted_score} pts</span>
              </div>
            )
          })}
        </div>
        <div className="px-4 py-3 bg-black/20 border-t border-white/10 flex justify-between">
          <span className="text-sm text-muted">Total</span>
          <span className="text-sm font-bold font-mono text-white">{runningTotal} pts</span>
        </div>
      </div>

      {/* Selections recap */}
      <div className="bg-black/20 rounded-xl border border-white/10 p-4 space-y-2">
        <p className="text-xs text-muted/60 uppercase tracking-wide mb-3">Pairing Decisions</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted/60">R1 Your Defender:</span>{' '}
            <span className="text-white">{state.r1Defender}</span>
          </div>
          <div>
            <span className="text-muted/60">R1 Opp Defender:</span>{' '}
            <span className="text-white">{state.r1OppDefender}</span>
          </div>
          <div>
            <span className="text-muted/60">R1 Attackers:</span>{' '}
            <span className="text-white">{state.r1Attackers?.join(' & ')}</span>
          </div>
          <div>
            <span className="text-muted/60">R2 Your Defender:</span>{' '}
            <span className="text-white">{state.r2Defender}</span>
          </div>
          <div>
            <span className="text-muted/60">R2 Opp Defender:</span>{' '}
            <span className="text-white">{state.r2OppDefender}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          to={`/tournament/${id}/round/${roundId}`}
          className="flex-1 text-center px-5 py-3 bg-accent hover:bg-accent/90
            text-white font-semibold rounded-xl transition-colors"
          onClick={() => {
            // Mark as complete — wizard state stays in localStorage for review
          }}
        >
          Save & Complete Round
        </Link>
        <Link
          to={`/tournament/${id}`}
          className="flex-1 text-center px-5 py-3 bg-black/30 hover:bg-black/50 border border-white/10
            text-muted hover:text-white font-semibold rounded-xl transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
