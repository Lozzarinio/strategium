import { useState } from 'react'
import type { WizardHook } from '../../hooks/useWizardState'
import type { PairingRecord } from '../../types/optimization'

interface Props {
  wizard: WizardHook
  oppPlayers: string[]
}

export default function Step4({ wizard, oppPlayers }: Props) {
  const { state, setR1Pairings, predictedScore } = wizard
  const attackers = state.r1Attackers ?? []

  // Opp players who aren't the opp defender (can face your defender)
  const oppAttackers = oppPlayers.filter(p => p !== state.r1OppDefender)

  const [defVsOpp, setDefVsOpp] = useState('')           // which opp faced your defender
  const [atkVsOppDef, setAtkVsOppDef] = useState('')    // which of your attackers faced opp defender

  // Scores (pre-filled from matrix, editable)
  const [score1, setScore1] = useState<string>('')
  const [score2, setScore2] = useState<string>('')

  // When selections change, auto-fill scores
  function handleDefVsOpp(opp: string) {
    setDefVsOpp(opp)
    setScore1(String(predictedScore(state.r1Defender ?? '', opp)))
  }

  function handleAtkVsOppDef(atk: string) {
    setAtkVsOppDef(atk)
    setScore2(String(predictedScore(atk, state.r1OppDefender ?? '')))
  }

  function confirm() {
    const pairings: PairingRecord[] = [
      {
        your_player: state.r1Defender ?? '',
        opponent_player: defVsOpp,
        predicted_score: parseFloat(score1) || 0,
      },
      {
        your_player: atkVsOppDef,
        opponent_player: state.r1OppDefender ?? '',
        predicted_score: parseFloat(score2) || 0,
      },
    ]
    setR1Pairings(pairings)
  }

  const canConfirm = defVsOpp && atkVsOppDef && score1 !== '' && score2 !== ''

  // The other attacker (the one not used in R1 — goes to R2)
  const r2Attacker = attackers.find(a => a !== atkVsOppDef)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Step 4 — Record Round 1 Pairings</h2>
        <p className="text-sm text-muted">
          Two games are played in Round 1. Record who faced whom and adjust predicted scores if needed.
        </p>
      </div>

      {/* Pairing 1: Your Defender vs Opp Attacker */}
      <div className="bg-black/30 rounded-xl border border-white/10 p-4 space-y-3">
        <p className="text-xs text-muted/60 uppercase tracking-wide">Game 1</p>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-black/40 rounded-lg px-3 py-2 text-sm font-bold text-white min-w-[80px] text-center">
            {state.r1Defender}
          </div>
          <span className="text-muted text-sm">vs</span>
          <select
            value={defVsOpp}
            onChange={e => handleDefVsOpp(e.target.value)}
            className="flex-1 min-w-[120px] bg-black/40 border border-white/20 rounded-lg px-3 py-2
              text-sm text-white focus:outline-none focus:border-accent"
          >
            <option value="">Select opp player…</option>
            {oppAttackers.map(p => (
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
              value={score1}
              onChange={e => setScore1(e.target.value)}
              className="w-20 bg-black/40 border border-white/20 rounded-lg px-3 py-1.5
                text-sm text-white font-mono focus:outline-none focus:border-accent
                [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        )}
      </div>

      {/* Pairing 2: Your Attacker vs Opp Defender */}
      <div className="bg-black/30 rounded-xl border border-white/10 p-4 space-y-3">
        <p className="text-xs text-muted/60 uppercase tracking-wide">Game 2</p>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={atkVsOppDef}
            onChange={e => handleAtkVsOppDef(e.target.value)}
            className="flex-1 min-w-[120px] bg-black/40 border border-white/20 rounded-lg px-3 py-2
              text-sm text-white focus:outline-none focus:border-accent"
          >
            <option value="">Select your attacker…</option>
            {attackers.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <span className="text-muted text-sm">vs</span>
          <div className="bg-black/40 rounded-lg px-3 py-2 text-sm font-bold text-white min-w-[80px] text-center">
            {state.r1OppDefender}
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
              value={score2}
              onChange={e => setScore2(e.target.value)}
              className="w-20 bg-black/40 border border-white/20 rounded-lg px-3 py-1.5
                text-sm text-white font-mono focus:outline-none focus:border-accent
                [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        )}
      </div>

      {/* Round 2 preview */}
      {atkVsOppDef && r2Attacker && (
        <div className="bg-black/20 rounded-xl border border-white/10 p-4">
          <p className="text-xs text-muted/60 uppercase tracking-wide mb-2">Entering Round 2</p>
          <p className="text-sm text-muted">
            <span className="text-white font-medium">{r2Attacker}</span> and the remaining 2 players
            of your team will form the Round 2 pool.
          </p>
        </div>
      )}

      <button
        onClick={confirm}
        disabled={!canConfirm}
        className="w-full py-3 bg-accent hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed
          text-white font-semibold rounded-xl transition-all"
      >
        Confirm Round 1 Pairings
      </button>
    </div>
  )
}
