import { useState, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'

// ── Types ─────────────────────────────────────────────────────────────────────

type PredRow = Record<string, number>
type PredMatrix = Record<string, PredRow | null>
type OptimizerState = 'idle' | 'loading' | 'results'

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_ROUND = {
  roundNumber: 1,
  opponent: {
    name: 'Thunder Warriors',
    players: [
      { name: 'Enemy1', faction: 'Chaos' },
      { name: 'Enemy2', faction: 'Death Guard' },
      { name: 'Enemy3', faction: 'Th. Sons' },
      { name: 'Enemy4', faction: 'Night Lords' },
      { name: 'Enemy5', faction: 'World Eaters' },
    ],
  },
}

const YOUR_PLAYERS = [
  { name: 'Alice', faction: 'Space Marines' },
  { name: 'Bob', faction: 'Orks' },
  { name: 'Carol', faction: 'Necrons' },
  { name: 'Dave', faction: 'Tau' },
  { name: 'Eve', faction: 'Tyranids' },
]

const INITIAL_PREDICTIONS: PredMatrix = {
  Alice: { Enemy1: 14, Enemy2: 12, Enemy3: 16, Enemy4: 10, Enemy5: 18 },
  Bob: { Enemy1: 12, Enemy2: 15, Enemy3: 10, Enemy4: 18, Enemy5: 14 },
  Carol: { Enemy1: 16, Enemy2: 11, Enemy3: 13, Enemy4: 15, Enemy5: 12 },
  Dave: null,
  Eve: null,
}

const FILL_MOCK: PredMatrix = {
  Dave: { Enemy1: 9, Enemy2: 17, Enemy3: 11, Enemy4: 14, Enemy5: 16 },
  Eve: { Enemy1: 13, Enemy2: 10, Enemy3: 15, Enemy4: 12, Enemy5: 18 },
}

const MOCK_RESULTS = {
  defender: 'Alice',
  worstCase: 66.5,
  bestCase: 72.0,
  scenarios: 130000,
  timeMs: 4200,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isRowComplete(row: PredRow | null, opponents: typeof MOCK_ROUND.opponent.players): boolean {
  if (!row) return false
  return opponents.every(op => row[op.name] !== undefined)
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RoundDetail() {
  const { id, roundId } = useParams()

  const [predictions, setPredictions] = useState<PredMatrix>(INITIAL_PREDICTIONS)
  const [editingCell, setEditingCell] = useState<{ player: string; opponent: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [optimizerState, setOptimizerState] = useState<OptimizerState>('idle')
  const editInputRef = useRef<HTMLInputElement>(null)

  const opponents = MOCK_ROUND.opponent.players

  const allSubmitted = YOUR_PLAYERS.every(p => isRowComplete(predictions[p.name], opponents))
  const submittedCount = YOUR_PLAYERS.filter(p => isRowComplete(predictions[p.name], opponents)).length
  const missingPlayers = YOUR_PLAYERS.filter(p => !isRowComplete(predictions[p.name], opponents))

  // ── Cell editing ────────────────────────────────────────────────────────────

  function startEdit(player: string, opponent: string) {
    const current = predictions[player]?.[opponent]
    setEditValue(current !== undefined ? String(current) : '')
    setEditingCell({ player, opponent })
  }

  function commitEdit() {
    if (!editingCell) return
    const val = parseFloat(editValue)
    if (!isNaN(val) && val >= 0 && val <= 20 && Math.round(val * 2) === val * 2) {
      setPredictions(prev => ({
        ...prev,
        [editingCell.player]: {
          ...(prev[editingCell.player] ?? {}),
          [editingCell.opponent]: val,
        },
      }))
    }
    setEditingCell(null)
  }

  function handleEditKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
    if (e.key === 'Escape') { e.preventDefault(); setEditingCell(null) }
  }

  // ── Optimizer ───────────────────────────────────────────────────────────────

  function runOptimizer() {
    setOptimizerState('loading')
    setTimeout(() => setOptimizerState('results'), 2000)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">

      {/* ── BREADCRUMB ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-muted mb-6">
        <Link to={`/tournament/${id}`} className="hover:text-white transition-colors">
          Dashboard
        </Link>
        <span>/</span>
        <span className="text-white">Round {roundId ?? MOCK_ROUND.roundNumber}</span>
      </div>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">
          Round {MOCK_ROUND.roundNumber}
          <span className="text-muted font-normal"> vs </span>
          {MOCK_ROUND.opponent.name}
        </h1>
        <p className="text-muted text-sm mt-1">
          Click any cell in the matrix to edit that player's prediction.
        </p>
      </div>

      {/* ── PREDICTION MATRIX ──────────────────────────────────────────────── */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-white">Prediction Matrix</h2>
          <span className="text-xs text-muted bg-white/5 border border-white/10 rounded-full px-3 py-1">
            {submittedCount} / {YOUR_PLAYERS.length} submitted
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full border-collapse min-w-[640px]">
            <thead>
              <tr className="bg-black/40">
                {/* Corner cell */}
                <th className="px-4 py-3 text-left w-36 border-b border-r border-white/10">
                  <span className="text-xs text-muted/60 uppercase tracking-wide">
                    Your Player
                  </span>
                </th>
                {opponents.map(op => (
                  <th
                    key={op.name}
                    className="px-3 py-3 text-center border-b border-r border-white/10 last:border-r-0 w-24"
                  >
                    <p className="text-sm font-semibold text-white leading-tight">{op.name}</p>
                    <p className="text-[10px] text-muted/70 mt-0.5">{op.faction}</p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {YOUR_PLAYERS.map((player, rowIdx) => {
                const row = predictions[player.name]
                const submitted = isRowComplete(row, opponents)
                return (
                  <tr
                    key={player.name}
                    className={`border-b border-white/5 last:border-0 transition-colors ${
                      rowIdx % 2 === 0 ? 'bg-black/10' : 'bg-black/20'
                    }`}
                  >
                    {/* Row header */}
                    <td className="px-4 py-3 border-r border-white/10">
                      <div className="flex items-center gap-2">
                        {submitted ? (
                          <svg className="w-3.5 h-3.5 text-success shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-white leading-tight">{player.name}</p>
                          <p className="text-[10px] text-muted/60">{player.faction}</p>
                        </div>
                      </div>
                    </td>

                    {/* Score cells */}
                    {opponents.map(op => {
                      const score = row?.[op.name]
                      const isEditing =
                        editingCell?.player === player.name &&
                        editingCell?.opponent === op.name

                      return (
                        <td
                          key={op.name}
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
                              onBlur={commitEdit}
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

      {/* ── PREDICTION STATUS ───────────────────────────────────────────────── */}
      <section className="bg-black/30 rounded-xl border border-white/10 p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white mb-2">Submission Status</h2>
            <div className="flex flex-wrap gap-2">
              {YOUR_PLAYERS.map(p => {
                const done = isRowComplete(predictions[p.name], opponents)
                return (
                  <div
                    key={p.name}
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
          </div>

          {/* Fill mock data button — for testing only */}
          {!allSubmitted && (
            <button
              onClick={() => setPredictions(prev => ({ ...prev, ...FILL_MOCK }))}
              className="text-xs text-muted/60 hover:text-muted border border-white/10 hover:border-white/20 rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap self-start sm:self-auto"
            >
              Fill {missingPlayers.map(p => p.name).join(' & ')} (test)
            </button>
          )}
        </div>
      </section>

      {/* ── OPTIMIZER ──────────────────────────────────────────────────────── */}
      <section className="bg-black/30 rounded-xl border border-white/10 p-5">
        <h2 className="text-base font-semibold text-white mb-4">Optimizer</h2>

        {/* Idle state */}
        {optimizerState === 'idle' && (
          <div>
            <div title={!allSubmitted ? 'Waiting for all player predictions' : undefined}>
              <button
                onClick={runOptimizer}
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

        {/* Loading state */}
        {optimizerState === 'loading' && (
          <div className="flex items-center gap-3 py-2">
            <svg
              className="w-5 h-5 text-accent animate-spin"
              fill="none" viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <span className="text-muted text-sm">
              Enumerating game tree (~130,000 scenarios)…
            </span>
          </div>
        )}

        {/* Results state */}
        {optimizerState === 'results' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Recommended defender */}
              <div className="bg-black/40 rounded-xl p-4 border border-accent/30">
                <p className="text-xs text-muted/70 uppercase tracking-wide mb-1">Recommended Defender</p>
                <p className="text-2xl font-bold text-accent">{MOCK_RESULTS.defender}</p>
              </div>

              {/* Worst case */}
              <div className="bg-black/40 rounded-xl p-4 border border-white/10">
                <p className="text-xs text-muted/70 uppercase tracking-wide mb-1">Worst Case Score</p>
                <p className="text-2xl font-bold text-white font-mono">
                  {MOCK_RESULTS.worstCase}
                  <span className="text-sm text-muted font-normal ml-1">pts</span>
                </p>
                <p className="text-xs text-muted/60 mt-0.5">Guaranteed minimum</p>
              </div>

              {/* Best case */}
              <div className="bg-black/40 rounded-xl p-4 border border-white/10">
                <p className="text-xs text-muted/70 uppercase tracking-wide mb-1">Best Case Score</p>
                <p className="text-2xl font-bold text-white font-mono">
                  {MOCK_RESULTS.bestCase}
                  <span className="text-sm text-muted font-normal ml-1">pts</span>
                </p>
                <p className="text-xs text-muted/60 mt-0.5">If all goes your way</p>
              </div>
            </div>

            <p className="text-xs text-muted/60">
              {MOCK_RESULTS.scenarios.toLocaleString()} scenarios evaluated in{' '}
              {(MOCK_RESULTS.timeMs / 1000).toFixed(1)}s
            </p>

            <Link
              to={`/tournament/${id}/round/${roundId ?? '1'}/wizard`}
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
