import { useState } from 'react'
import type { WizardHook } from '../../hooks/useWizardState'
import type { PairingRecord } from '../../types/optimization'

interface Props {
  wizard: WizardHook
}

export default function Step7({ wizard }: Props) {
  const { state, r2YourPlayers, r2OppPlayers, setR2Pairings, predictedScore } = wizard

  const r2OppAttackers = r2OppPlayers.filter(p => p !== state.r2OppDefender)
  const r2YourAttackers = r2YourPlayers.filter(p => p !== state.r2Defender)

  const [defVsOpp, setDefVsOpp] = useState('')
  const [atkVsOppDef, setAtkVsOppDef] = useState('')
  const [score3, setScore3] = useState('')
  const [score4, setScore4] = useState('')

  function handleDefVsOpp(opp: string) {
    setDefVsOpp(opp)
    setScore3(String(predictedScore(state.r2Defender ?? '', opp)))
  }

  function handleAtkVsOppDef(atk: string) {
    setAtkVsOppDef(atk)
    setScore4(String(predictedScore(atk, state.r2OppDefender ?? '')))
  }

  // 5th pairing preview (automatic)
  const remainingYour = r2YourAttackers.find(p => p !== atkVsOppDef)
  const remainingOpp  = r2OppAttackers.find(p => p !== defVsOpp)
  const score5Preview = remainingYour && remainingOpp
    ? predictedScore(remainingYour, remainingOpp)
    : null

  const r1Total = state.r1Pairings.reduce((s, p) => s + p.predicted_score, 0)
  const r2RunningTotal = (parseFloat(score3) || 0) + (parseFloat(score4) || 0)

  function confirm() {
    const pairings: PairingRecord[] = [
      {
        your_player: state.r2Defender ?? '',
        opponent_player: defVsOpp,
        predicted_score: parseFloat(score3) || 0,
      },
      {
        your_player: atkVsOppDef,
        opponent_player: state.r2OppDefender ?? '',
        predicted_score: parseFloat(score4) || 0,
      },
    ]
    setR2Pairings(pairings)
  }

  const canConfirm = defVsOpp && atkVsOppDef && score3 !== '' && score4 !== ''

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Step 7 — Record Round 2 Pairings</h2>
        <p className="text-sm text-muted">
          Two explicit games in Round 2. The 5th pairing is determined automatically.
        </p>
      </div>

      {/* Running total */}
      <div className="bg-black/20 rounded-xl border border-white/10 p-4">
        <p className="text-xs text-muted/60 uppercase tracking-wide mb-1">Running Total (R1)</p>
        <p className="text-2xl font-bold font-mono text-white">
          {r1Total} <span className="text-sm text-muted font-normal">pts</span>
        </p>
      </div>

      {/* Game 3: R2 Defender vs Opp Attacker */}
      <div className="bg-black/30 rounded-xl border border-white/10 p-4 space-y-3">
        <p className="text-xs text-muted/60 uppercase tracking-wide">Game 3</p>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-black/40 rounded-lg px-3 py-2 text-sm font-bold text-white min-w-[80px] text-center">
            {state.r2Defender}
          </div>
          <span className="text-muted text-sm">vs</span>
          <select
            value={defVsOpp}
            onChange={e => handleDefVsOpp(e.target.value)}
            className="flex-1 min-w-[120px] bg-black/40 border border-white/20 rounded-lg px-3 py-2
              text-sm text-white focus:outline-none focus:border-accent"
          >
            <option value="">Select opp player…</option>
            {r2OppAttackers.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        {defVsOpp && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted/60">Predicted score:</label>
            <input
              type="number"
              min="0"
              max="20"
              step="0.5"
              value={score3}
              onChange={e => setScore3(e.target.value)}
              className="w-20 bg-black/40 border border-white/20 rounded-lg px-3 py-1.5
                text-sm text-white font-mono focus:outline-none focus:border-accent
                [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        )}
      </div>

      {/* Game 4: Your R2 Attacker vs Opp R2 Defender */}
      <div className="bg-black/30 rounded-xl border border-white/10 p-4 space-y-3">
        <p className="text-xs text-muted/60 uppercase tracking-wide">Game 4</p>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={atkVsOppDef}
            onChange={e => handleAtkVsOppDef(e.target.value)}
            className="flex-1 min-w-[120px] bg-black/40 border border-white/20 rounded-lg px-3 py-2
              text-sm text-white focus:outline-none focus:border-accent"
          >
            <option value="">Select your attacker…</option>
            {r2YourAttackers.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <span className="text-muted text-sm">vs</span>
          <div className="bg-black/40 rounded-lg px-3 py-2 text-sm font-bold text-white min-w-[80px] text-center">
            {state.r2OppDefender}
          </div>
        </div>
        {atkVsOppDef && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted/60">Predicted score:</label>
            <input
              type="number"
              min="0"
              max="20"
              step="0.5"
              value={score4}
              onChange={e => setScore4(e.target.value)}
              className="w-20 bg-black/40 border border-white/20 rounded-lg px-3 py-1.5
                text-sm text-white font-mono focus:outline-none focus:border-accent
                [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        )}
      </div>

      {/* Game 5 preview */}
      {remainingYour && remainingOpp && (
        <div className="bg-black/20 rounded-xl border border-white/10 p-4">
          <p className="text-xs text-muted/60 uppercase tracking-wide mb-2">Game 5 (automatic)</p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-white">
              {remainingYour} <span className="text-muted">vs</span> {remainingOpp}
            </span>
            <span className="text-sm text-white font-mono">{score5Preview} pts</span>
          </div>
        </div>
      )}

      {/* Projected total */}
      {canConfirm && score5Preview !== null && (
        <div className="bg-black/20 rounded-xl border border-white/10 p-4">
          <p className="text-xs text-muted/60 uppercase tracking-wide mb-1">Projected Total</p>
          <p className="text-2xl font-bold font-mono text-white">
            {r1Total + r2RunningTotal + score5Preview}{' '}
            <span className="text-sm text-muted font-normal">pts</span>
          </p>
        </div>
      )}

      <button
        onClick={confirm}
        disabled={!canConfirm}
        className="w-full py-3 bg-accent hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed
          text-white font-semibold rounded-xl transition-all"
      >
        Confirm Round 2 Pairings
      </button>
    </div>
  )
}
