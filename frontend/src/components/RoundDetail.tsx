import { useState, useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type { RoundDetailOut, TournamentOut } from '../api/client'
import type { OptimizationResult } from '../types/optimization'

// ── Types ─────────────────────────────────────────────────────────────────────

type PredRow = Record<string, number>
type PredMatrix = Record<string, PredRow | null>
type OptimizerState = 'idle' | 'loading' | 'results' | 'error'

// ── Helpers ───────────────────────────────────────────────────────────────────

function isRowComplete(row: PredRow | null, opponents: Array<{ name: string }>): boolean {
  if (!row) return false
  return opponents.every(op => row[op.name] !== undefined)
}

// Stores optimizer context in localStorage so the wizard can load it.
function storeOptimizerContext(
  roundId: string,
  optimizationResult: OptimizationResult,
  yourPlayers: string[],
  oppPlayers: string[],
  predictions: PredMatrix,
) {
  try {
    localStorage.setItem(
      `strategium-optimizer-${roundId}`,
      JSON.stringify({ optimizationResult, yourPlayers, oppPlayers, predictions }),
    )
  } catch { /* ignore storage errors */ }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RoundDetail() {
  const { id, roundId } = useParams<{ id: string; roundId: string }>()

  // Remote data
  const [roundData, setRoundData] = useState<RoundDetailOut | null>(null)
  const [tournament, setTournament] = useState<TournamentOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Prediction matrix (local editable copy)
  const [predictions, setPredictions] = useState<PredMatrix>({})
  const [editingCell, setEditingCell] = useState<{ player: string; opponent: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [submittingRow, setSubmittingRow] = useState<string | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  // Optimizer
  const [optimizerState, setOptimizerState] = useState<OptimizerState>('idle')
  const [optimizerError, setOptimizerError] = useState<string | null>(null)
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null)

  // ── Load data on mount ────────────────────────────────────────────────────

  useEffect(() => {
    if (!id || !roundId) return
    setLoading(true)
    setLoadError(null)

    Promise.all([
      api.getTournament(id),
      api.getRound(roundId),
    ])
      .then(([t, r]) => {
        setTournament(t)
        setRoundData(r)
        // Initialise prediction matrix from round data
        const matrix: PredMatrix = {}
        for (const player of t.team.players) {
          const row = r.predictions[player.name]
          matrix[player.name] = row && Object.keys(row).length > 0 ? row : null
        }
        setPredictions(matrix)
      })
      .catch(err => {
        setLoadError(
          err instanceof ApiError ? err.message : 'Failed to load round — is the backend running?'
        )
      })
      .finally(() => setLoading(false))
  }, [id, roundId])

  // ── Cell editing ──────────────────────────────────────────────────────────

  function startEdit(player: string, opponent: string) {
    const current = predictions[player]?.[opponent]
    setEditValue(current !== undefined ? String(current) : '')
    setEditingCell({ player, opponent })
  }

  async function commitEdit() {
    if (!editingCell || !tournament || !roundData?.opponent_team) {
      setEditingCell(null)
      return
    }
    const val = parseFloat(editValue)
    if (!isNaN(val) && val >= 0 && val <= 20 && Math.round(val * 2) === val * 2) {
      const { player: playerName, opponent: oppName } = editingCell
      const updatedRow: PredRow = {
        ...(predictions[playerName] ?? {}),
        [oppName]: val,
      }
      const updatedMatrix = { ...predictions, [playerName]: updatedRow }
      setPredictions(updatedMatrix)

      // Auto-submit when the whole row is now complete
      const opponents = roundData.opponent_team.players
      if (isRowComplete(updatedRow, opponents)) {
        const predDict: Record<string, number> = {}
        opponents.forEach(op => { predDict[op.name] = updatedRow[op.name] })
        setSubmittingRow(playerName)
        try {
          await api.submitPredictions(
            tournament.session.code,
            playerName,
            roundData.round_number,
            predDict,
          )
        } catch (err) {
          console.error('Failed to submit predictions for', playerName, err)
        } finally {
          setSubmittingRow(null)
        }
      }
    }
    setEditingCell(null)
  }

  function handleEditKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); void commitEdit() }
    if (e.key === 'Escape') { e.preventDefault(); setEditingCell(null) }
  }

  // ── Optimizer ─────────────────────────────────────────────────────────────

  async function runOptimizer() {
    if (!roundId || !tournament || !roundData?.opponent_team) return
    setOptimizerState('loading')
    setOptimizerError(null)
    try {
      const result = await api.runOptimizer(roundId)
      setOptimizationResult(result)
      setOptimizerState('results')

      // Persist context to localStorage for the wizard
      const yourPlayers = tournament.team.players.map(p => p.name)
      const oppPlayers = roundData.opponent_team.players.map(p => p.name)
      const predsCopy: PredMatrix = {}
      yourPlayers.forEach(name => { predsCopy[name] = predictions[name] ?? null })
      storeOptimizerContext(roundId, result, yourPlayers, oppPlayers, predsCopy)
    } catch (err) {
      setOptimizerState('error')
      setOptimizerError(
        err instanceof ApiError ? err.message : 'Optimizer failed — is the backend running?'
      )
    }
  }

  // ── Loading / error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <div className="flex items-center justify-center gap-3 text-muted">
          <svg className="w-5 h-5 animate-spin text-accent" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Loading round…
        </div>
      </div>
    )
  }

  if (loadError || !roundData || !tournament) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <p className="text-danger mb-4">{loadError ?? 'Round not found.'}</p>
        <Link to={`/tournament/${id}`} className="text-accent hover:underline text-sm">← Back to Dashboard</Link>
      </div>
    )
  }

  if (!roundData.opponent_team) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <p className="text-muted mb-4">No opponent assigned to this round yet.</p>
        <Link to={`/tournament/${id}`} className="text-accent hover:underline text-sm">← Back to Dashboard</Link>
      </div>
    )
  }

  const opponents = roundData.opponent_team.players
  const yourPlayers = tournament.team.players
  const allSubmitted = yourPlayers.every(p => isRowComplete(predictions[p.name], opponents))
  const submittedCount = yourPlayers.filter(p => isRowComplete(predictions[p.name], opponents)).length
  const missingPlayers = yourPlayers.filter(p => !isRowComplete(predictions[p.name], opponents))

  const recommendedDefender = optimizationResult?.round_1.defender_options.find(d => d.is_recommended)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">

      {/* ── BREADCRUMB ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-muted mb-6">
        <Link to={`/tournament/${id}`} className="hover:text-white transition-colors">
          Dashboard
        </Link>
        <span>/</span>
        <span className="text-white">Round {roundData.round_number}</span>
      </div>

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">
          Round {roundData.round_number}
          <span className="text-muted font-normal"> vs </span>
          {roundData.opponent_team.name}
        </h1>
        <p className="text-muted text-sm mt-1">
          Click any cell to edit that player's prediction. Complete rows are auto-saved.
        </p>
      </div>

      {/* ── PREDICTION MATRIX ───────────────────────────────────────────────── */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-white">Prediction Matrix</h2>
          <span className="text-xs text-muted bg-white/5 border border-white/10 rounded-full px-3 py-1">
            {submittedCount} / {yourPlayers.length} submitted
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full border-collapse min-w-[640px]">
            <thead>
              <tr className="bg-black/40">
                <th className="px-4 py-3 text-left w-36 border-b border-r border-white/10">
                  <span className="text-xs text-muted/60 uppercase tracking-wide">Your Player</span>
                </th>
                {opponents.map(op => (
                  <th
                    key={op.id}
                    className="px-3 py-3 text-center border-b border-r border-white/10 last:border-r-0 w-24"
                  >
                    <p className="text-sm font-semibold text-white leading-tight">{op.name}</p>
                    <p className="text-[10px] text-muted/70 mt-0.5">{op.faction}</p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {yourPlayers.map((player, rowIdx) => {
                const row = predictions[player.name]
                const submitted = isRowComplete(row, opponents)
                const isSaving = submittingRow === player.name
                return (
                  <tr
                    key={player.id}
                    className={`border-b border-white/5 last:border-0 transition-colors ${
                      rowIdx % 2 === 0 ? 'bg-black/10' : 'bg-black/20'
                    }`}
                  >
                    <td className="px-4 py-3 border-r border-white/10">
                      <div className="flex items-center gap-2">
                        {isSaving ? (
                          <svg className="w-3.5 h-3.5 text-accent animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                          </svg>
                        ) : submitted ? (
                          <svg className="w-3.5 h-3.5 text-success shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-white leading-tight">{player.name}</p>
                          {player.faction && <p className="text-[10px] text-muted/60">{player.faction}</p>}
                        </div>
                      </div>
                    </td>
                    {opponents.map(op => {
                      const score = row?.[op.name]
                      const isEditing =
                        editingCell?.player === player.name &&
                        editingCell?.opponent === op.name

                      return (
                        <td
                          key={op.id}
                          onClick={() => !isEditing && startEdit(player.name, op.name)}
                          className="px-2 py-2 text-center border-r border-white/5 last:border-r-0
                            cursor-pointer hover:bg-accent/10 transition-colors group"
                        >
                          {isEditing ? (
                            <input
                              ref={editInputRef}
                              type="number"
                              min="0"
                              max="20"
                              step="0.5"
                              inputMode="decimal"
                              autoFocus
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={() => void commitEdit()}
                              onKeyDown={handleEditKeyDown}
                              className="w-16 text-center bg-black/60 border border-accent rounded-md
                                px-1 py-1.5 text-white text-sm font-mono focus:outline-none
                                [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          ) : (
                            <span
                              className={`text-sm font-mono font-semibold transition-colors ${
                                score !== undefined
                                  ? 'text-white group-hover:text-accent'
                                  : 'text-muted/30'
                              }`}
                            >
                              {score !== undefined ? score : '—'}
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── PREDICTION STATUS ──────────────────────────────────────────────── */}
      <section className="bg-black/30 rounded-xl border border-white/10 p-5 mb-6">
        <h2 className="text-base font-semibold text-white mb-2">Submission Status</h2>
        <div className="flex flex-wrap gap-2">
          {yourPlayers.map(p => {
            const done = isRowComplete(predictions[p.name], opponents)
            return (
              <div
                key={p.id}
                className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border ${
                  done
                    ? 'border-success/30 bg-success/10 text-success'
                    : 'border-white/10 bg-black/20 text-muted'
                }`}
              >
                {done ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                {p.name}
              </div>
            )
          })}
        </div>
        {!allSubmitted && (
          <p className="mt-2 text-xs text-muted/60">
            Waiting for predictions from{' '}
            <span className="text-muted">{missingPlayers.map(p => p.name).join(', ')}</span>
          </p>
        )}
      </section>

      {/* ── OPTIMIZER ──────────────────────────────────────────────────────── */}
      <section className="bg-black/30 rounded-xl border border-white/10 p-5">
        <h2 className="text-base font-semibold text-white mb-4">Optimizer</h2>

        {optimizerState === 'idle' && (
          <div>
            <div title={!allSubmitted ? 'Waiting for all player predictions' : undefined}>
              <button
                onClick={() => void runOptimizer()}
                disabled={!allSubmitted}
                className="px-5 py-2.5 bg-accent hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed
                  text-white font-semibold rounded-lg transition-all text-sm"
              >
                Run Optimizer
              </button>
            </div>
            {!allSubmitted && (
              <p className="mt-2 text-xs text-muted/60">
                Waiting for predictions from{' '}
                <span className="text-muted">{missingPlayers.map(p => p.name).join(', ')}</span>
              </p>
            )}
          </div>
        )}

        {optimizerState === 'loading' && (
          <div className="flex items-center gap-3 py-2">
            <svg className="w-5 h-5 text-accent animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <span className="text-muted text-sm">
              Enumerating game tree (~130,000 scenarios)…
            </span>
          </div>
        )}

        {optimizerState === 'error' && (
          <div>
            <p className="text-danger text-sm mb-3">{optimizerError}</p>
            <button
              onClick={() => { setOptimizerState('idle'); setOptimizerError(null) }}
              className="text-xs text-muted hover:text-white border border-white/10 rounded-lg px-3 py-1.5 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {optimizerState === 'results' && optimizationResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-black/40 rounded-xl p-4 border border-accent/30">
                <p className="text-xs text-muted/70 uppercase tracking-wide mb-1">Recommended Defender</p>
                <p className="text-2xl font-bold text-accent">{recommendedDefender?.player}</p>
              </div>
              <div className="bg-black/40 rounded-xl p-4 border border-white/10">
                <p className="text-xs text-muted/70 uppercase tracking-wide mb-1">Worst Case Score</p>
                <p className="text-2xl font-bold text-white font-mono">
                  {recommendedDefender?.worst_case_total}
                  <span className="text-sm text-muted font-normal ml-1">pts</span>
                </p>
                <p className="text-xs text-muted/60 mt-0.5">Guaranteed minimum</p>
              </div>
              <div className="bg-black/40 rounded-xl p-4 border border-white/10">
                <p className="text-xs text-muted/70 uppercase tracking-wide mb-1">Best Case Score</p>
                <p className="text-2xl font-bold text-white font-mono">
                  {recommendedDefender?.best_case_total}
                  <span className="text-sm text-muted font-normal ml-1">pts</span>
                </p>
                <p className="text-xs text-muted/60 mt-0.5">If all goes your way</p>
              </div>
            </div>

            <p className="text-xs text-muted/60">
              {optimizationResult.metadata.total_scenarios.toLocaleString()} scenarios evaluated in{' '}
              {(optimizationResult.metadata.computation_time_ms / 1000).toFixed(1)}s
            </p>

            <Link
              to={`/tournament/${id}/round/${roundId}/wizard`}
              className="inline-flex items-center gap-2 px-5 py-3 bg-accent hover:bg-accent/90
                text-white font-semibold rounded-lg transition-colors text-sm"
            >
              Start Pairing Wizard →
            </Link>
          </div>
        )}
      </section>

    </div>
  )
}
