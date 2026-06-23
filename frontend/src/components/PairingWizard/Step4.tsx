import { useState } from 'react'
import type { WizardHook } from '../../hooks/useWizardState'
import type { PairingRecord } from '../../types/optimization'

interface Props {
  wizard: WizardHook
  yourPlayers: string[]
  oppPlayers: string[]
}

export default function Step4({ wizard, yourPlayers, oppPlayers }: Props) {
  const { state, setR1Pairings, predictedScore } = wizard
  const sentAttackers = state.r1Attackers ?? []

  // Opp players who aren't the opp defender — the 4 candidates the opponent could send
  const oppAttackerPool = oppPlayers.filter(p => p !== state.r1OppDefender)

  // ── Section A: which 2 opponent attackers did the captain receive? ──────────
  const [received, setReceived] = useState<string[]>([])

  function toggleReceived(player: string) {
    setReceived(prev => {
      if (prev.includes(player)) return prev.filter(p => p !== player)
      if (prev.length >= 2) return prev
      return [...prev, player]
    })
  }

  // ── Section B: which received opponent attacker faces your defender? ────────
  const [defVsOpp, setDefVsOpp] = useState('')

  // ── Section C: which of your sent attackers faces the opponent defender? ────
  const [atkVsOppDef, setAtkVsOppDef] = useState('')

  // Reset downstream selections if their source set changes
  function handleToggleReceived(player: string) {
    toggleReceived(player)
    setDefVsOpp('')
  }

  const score1 = predictedScore(state.r1Defender ?? '', defVsOpp)
  const score2 = predictedScore(atkVsOppDef, state.r1OppDefender ?? '')

  const canConfirm = received.length === 2 && !!defVsOpp && !!atkVsOppDef

  // ── Remaining players entering Round 2 ───────────────────────────────────────
  const yourRemaining = canConfirm
    ? yourPlayers.filter(p => p !== state.r1Defender && p !== atkVsOppDef)
    : []
  const oppRemaining = canConfirm
    ? oppPlayers.filter(p => p !== state.r1OppDefender && p !== defVsOpp)
    : []

  function confirm() {
    const pairings: PairingRecord[] = [
      {
        your_player: state.r1Defender ?? '',
        opponent_player: defVsOpp,
        predicted_score: score1,
      },
      {
        your_player: atkVsOppDef,
        opponent_player: state.r1OppDefender ?? '',
        predicted_score: score2,
      },
    ]
    setR1Pairings(pairings)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Step 4 — Record Round 1 Pairings</h2>
        <p className="text-sm text-muted">
          Attackers have been exchanged face-down and secretly assigned. Record what happened at the table.
        </p>
      </div>

      {/* Context summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-black/20 rounded-xl border border-white/10 p-3">
          <p className="text-xs text-muted/60 uppercase tracking-wide mb-0.5">Your Defender</p>
          <p className="text-sm font-bold text-white">{state.r1Defender}</p>
        </div>
        <div className="bg-black/20 rounded-xl border border-white/10 p-3">
          <p className="text-xs text-muted/60 uppercase tracking-wide mb-0.5">Opp Defender</p>
          <p className="text-sm font-bold text-white">{state.r1OppDefender}</p>
        </div>
        <div className="bg-black/20 rounded-xl border border-white/10 p-3">
          <p className="text-xs text-muted/60 uppercase tracking-wide mb-0.5">You Sent</p>
          <p className="text-sm font-bold text-white">{sentAttackers.join(' & ')}</p>
        </div>
      </div>

      {/* ── Section A ─────────────────────────────────────────────────────────── */}
      <div className="bg-black/30 rounded-xl border border-white/10 p-4 space-y-3">
        <p className="text-sm font-medium text-white">
          A. Which 2 attackers did the opponent send you? ({received.length}/2)
        </p>
        <div className="space-y-2">
          {oppAttackerPool.map(player => {
            const isSelected = received.includes(player)
            const isDisabled = !isSelected && received.length >= 2
            return (
              <button
                key={player}
                onClick={() => handleToggleReceived(player)}
                disabled={isDisabled}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left
                  ${isSelected
                    ? 'bg-accent/20 border-accent text-white'
                    : isDisabled
                    ? 'bg-black/10 border-white/5 text-muted/30 cursor-not-allowed'
                    : 'bg-black/20 border-white/10 text-muted hover:border-white/30 hover:text-white'
                  }`}
              >
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
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Section B ─────────────────────────────────────────────────────────── */}
      <div className="bg-black/30 rounded-xl border border-white/10 p-4 space-y-3">
        <p className="text-sm font-medium text-white">
          B. Which opponent attacker does your defender face?
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-black/40 rounded-lg px-3 py-2 text-sm font-bold text-white min-w-[80px] text-center">
            {state.r1Defender}
          </div>
          <span className="text-muted text-sm">vs</span>
          <select
            value={defVsOpp}
            onChange={e => setDefVsOpp(e.target.value)}
            disabled={received.length !== 2}
            className="flex-1 min-w-[120px] bg-black/40 border border-white/20 rounded-lg px-3 py-2
              text-sm text-white focus:outline-none focus:border-accent disabled:opacity-40"
          >
            <option value="">Select opp attacker…</option>
            {received.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        {defVsOpp && (
          <p className="text-xs text-muted/60">
            Predicted score: <span className="text-white font-mono">{score1} pts</span>
          </p>
        )}
      </div>

      {/* ── Section C ─────────────────────────────────────────────────────────── */}
      <div className="bg-black/30 rounded-xl border border-white/10 p-4 space-y-3">
        <p className="text-sm font-medium text-white">
          C. Which of your attackers faces the opponent's defender?
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={atkVsOppDef}
            onChange={e => setAtkVsOppDef(e.target.value)}
            className="flex-1 min-w-[120px] bg-black/40 border border-white/20 rounded-lg px-3 py-2
              text-sm text-white focus:outline-none focus:border-accent"
          >
            <option value="">Select your attacker…</option>
            {sentAttackers.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <span className="text-muted text-sm">vs</span>
          <div className="bg-black/40 rounded-lg px-3 py-2 text-sm font-bold text-white min-w-[80px] text-center">
            {state.r1OppDefender}
          </div>
        </div>
        {atkVsOppDef && (
          <p className="text-xs text-muted/60">
            Predicted score: <span className="text-white font-mono">{score2} pts</span>
          </p>
        )}
      </div>

      {/* ── Resulting pairings & Round 2 preview ─────────────────────────────────── */}
      {canConfirm && (
        <div className="bg-black/20 rounded-xl border border-white/10 p-4 space-y-3">
          <p className="text-xs text-muted/60 uppercase tracking-wide mb-1">Resulting Pairings</p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-white">
              Pairing 1: {state.r1Defender} <span className="text-muted">vs</span> {defVsOpp}
            </span>
            <span className="text-white font-mono">{score1} pts</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-white">
              Pairing 2: {atkVsOppDef} <span className="text-muted">vs</span> {state.r1OppDefender}
            </span>
            <span className="text-white font-mono">{score2} pts</span>
          </div>

          <div className="pt-2 border-t border-white/10">
            <p className="text-xs text-muted/60 uppercase tracking-wide mb-1">Entering Round 2</p>
            <p className="text-sm text-muted">
              <span className="text-white font-medium">Your side:</span> {yourRemaining.join(', ')}
            </p>
            <p className="text-sm text-muted">
              <span className="text-white font-medium">Opponent side:</span> {oppRemaining.join(', ')}
            </p>
          </div>
        </div>
      )}

      <button
        onClick={confirm}
        disabled={!canConfirm}
        className="w-full py-3 bg-accent hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed
          text-white font-semibold rounded-xl transition-all"
      >
        Continue to Round 2
      </button>
    </div>
  )
}
