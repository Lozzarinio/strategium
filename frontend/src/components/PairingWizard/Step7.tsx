import { useState } from 'react'
import type { WizardHook } from '../../hooks/useWizardState'
import type { PairingRecord } from '../../types/optimization'

interface Props {
  wizard: WizardHook
}

export default function Step7({ wizard }: Props) {
  const { state, r2YourPlayers, r2OppPlayers, setR2Pairings, predictedScore } = wizard

  // Both remaining players on each side are automatically sent as attackers
  const r2OppAttackers = r2OppPlayers.filter(p => p !== state.r2OppDefender)
  const r2YourAttackers = r2YourPlayers.filter(p => p !== state.r2Defender)

  // ── Section A: which opponent attacker does your defender face? ─────────────
  const [defVsOpp, setDefVsOpp] = useState('')

  // ── Section B: which of your attackers faces the opponent defender? ─────────
  const [atkVsOppDef, setAtkVsOppDef] = useState('')

  const score3 = predictedScore(state.r2Defender ?? '', defVsOpp)
  const score4 = predictedScore(atkVsOppDef, state.r2OppDefender ?? '')

  // Pairing 5 preview (automatic) — the unchosen player on each side
  const remainingYour = r2YourAttackers.find(p => p !== atkVsOppDef)
  const remainingOpp  = r2OppAttackers.find(p => p !== defVsOpp)
  const score5Preview = remainingYour && remainingOpp
    ? predictedScore(remainingYour, remainingOpp)
    : null

  const r1Total = state.r1Pairings.reduce((s, p) => s + p.predicted_score, 0)
  const r2RunningTotal = score3 + score4

  const canConfirm = !!defVsOpp && !!atkVsOppDef

  function confirm() {
    const pairings: PairingRecord[] = [
      {
        your_player: state.r2Defender ?? '',
        opponent_player: defVsOpp,
        predicted_score: score3,
      },
      {
        your_player: atkVsOppDef,
        opponent_player: state.r2OppDefender ?? '',
        predicted_score: score4,
      },
    ]
    setR2Pairings(pairings)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Step 7 — Record Round 2 Pairings</h2>
        <p className="text-sm text-muted">
          Both remaining players on each side are sent as attackers. Record what happened at the table.
        </p>
      </div>

      {/* Running total */}
      <div className="bg-black/20 rounded-xl border border-white/10 p-4">
        <p className="text-xs text-muted/60 uppercase tracking-wide mb-1">Running Total (R1)</p>
        <p className="text-2xl font-bold font-mono text-white">
          {r1Total} <span className="text-sm text-muted font-normal">pts</span>
        </p>
      </div>

      {/* Context summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-black/20 rounded-xl border border-white/10 p-3">
          <p className="text-xs text-muted/60 uppercase tracking-wide mb-0.5">Your Defender</p>
          <p className="text-sm font-bold text-white">{state.r2Defender}</p>
        </div>
        <div className="bg-black/20 rounded-xl border border-white/10 p-3">
          <p className="text-xs text-muted/60 uppercase tracking-wide mb-0.5">Opp Defender</p>
          <p className="text-sm font-bold text-white">{state.r2OppDefender}</p>
        </div>
      </div>

      {/* ── Section A ─────────────────────────────────────────────────────────── */}
      <div className="bg-black/30 rounded-xl border border-white/10 p-4 space-y-3">
        <p className="text-sm font-medium text-white">
          A. Which opponent attacker does your defender face?
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-black/40 rounded-lg px-3 py-2 text-sm font-bold text-white min-w-[80px] text-center">
            {state.r2Defender}
          </div>
          <span className="text-muted text-sm">vs</span>
          <select
            value={defVsOpp}
            onChange={e => setDefVsOpp(e.target.value)}
            className="flex-1 min-w-[120px] bg-black/40 border border-white/20 rounded-lg px-3 py-2
              text-sm text-white focus:outline-none focus:border-accent"
          >
            <option value="">Select opp attacker…</option>
            {r2OppAttackers.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        {defVsOpp && (
          <p className="text-xs text-muted/60">
            Predicted score: <span className="text-white font-mono">{score3} pts</span>
          </p>
        )}
      </div>

      {/* ── Section B ─────────────────────────────────────────────────────────── */}
      <div className="bg-black/30 rounded-xl border border-white/10 p-4 space-y-3">
        <p className="text-sm font-medium text-white">
          B. Which of your attackers faces the opponent's defender?
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={atkVsOppDef}
            onChange={e => setAtkVsOppDef(e.target.value)}
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
          <p className="text-xs text-muted/60">
            Predicted score: <span className="text-white font-mono">{score4} pts</span>
          </p>
        )}
      </div>

      {/* Pairing 5 preview */}
      {remainingYour && remainingOpp && (
        <div className="bg-black/20 rounded-xl border border-white/10 p-4">
          <p className="text-xs text-muted/60 uppercase tracking-wide mb-2">Pairing 5 (automatic)</p>
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
        Continue to Final Pairing
      </button>
    </div>
  )
}
