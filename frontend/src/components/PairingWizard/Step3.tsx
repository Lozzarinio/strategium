import { useState } from 'react'
import type { WizardHook } from '../../hooks/useWizardState'
import RecommendationCard from './RecommendationCard'

interface Props {
  wizard: WizardHook
  yourPlayers: string[]
}

export default function Step3({ wizard, yourPlayers }: Props) {
  const { state, setR1Attackers, getR1AttackerOptions } = wizard

  // Players available to be attackers (everyone except the defender)
  const pool = yourPlayers.filter(p => p !== state.r1Defender)
  const options = getR1AttackerOptions()
  const recommended = options.find(o => o.is_recommended)

  const [selected, setSelected] = useState<string[]>(
    state.r1Attackers ? [...state.r1Attackers] : []
  )

  function toggle(player: string) {
    setSelected(prev => {
      if (prev.includes(player)) return prev.filter(p => p !== player)
      if (prev.length >= 2) return prev  // already 2 selected
      return [...prev, player]
    })
  }

  function confirm() {
    if (selected.length === 2) {
      setR1Attackers(selected as [string, string])
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Step 3 — Select 2 Attackers</h2>
        <p className="text-sm text-muted">
          Choose 2 players to send as attackers. One will face the opponent's defender in Round 1;
          the other joins the Round 2 pool.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-black/20 rounded-xl border border-white/10 p-3">
          <p className="text-xs text-muted/60 uppercase tracking-wide mb-0.5">Your Defender</p>
          <p className="text-sm font-bold text-white">{state.r1Defender}</p>
        </div>
        <div className="bg-black/20 rounded-xl border border-white/10 p-3">
          <p className="text-xs text-muted/60 uppercase tracking-wide mb-0.5">Opp Defender</p>
          <p className="text-sm font-bold text-white">{state.r1OppDefender}</p>
        </div>
      </div>

      {recommended && (
        <RecommendationCard
          label="Optimizer recommends attackers"
          recommended={recommended.attackers.join(' & ')}
          worstCase={recommended.worst_case_total}
          bestCase={recommended.best_case_total}
        />
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium text-white">
          Select exactly 2 attackers ({selected.length}/2)
        </p>
        {pool.map(player => {
          const isSelected = selected.includes(player)
          const isRecAttacker = recommended?.attackers.includes(player) ?? false
          const isDisabled = !isSelected && selected.length >= 2

          return (
            <button
              key={player}
              onClick={() => toggle(player)}
              disabled={isDisabled}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border
                transition-all text-left
                ${isSelected
                  ? 'bg-accent/20 border-accent text-white'
                  : isDisabled
                  ? 'bg-black/10 border-white/5 text-muted/30 cursor-not-allowed'
                  : 'bg-black/20 border-white/10 text-muted hover:border-white/30 hover:text-white'
                }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0
                    ${isSelected ? 'border-accent bg-accent' : 'border-white/20'}`}
                >
                  {isSelected && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="font-medium">{player}</span>
                {isRecAttacker && (
                  <span className="text-xs bg-accent/20 text-accent border border-accent/30 rounded-full px-2 py-0.5">
                    Recommended
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <button
        onClick={confirm}
        disabled={selected.length !== 2}
        className="w-full py-3 bg-accent hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed
          text-white font-semibold rounded-xl transition-all"
      >
        Confirm Attackers{selected.length === 2 ? ` — ${selected.join(' & ')}` : ''}
      </button>
    </div>
  )
}
