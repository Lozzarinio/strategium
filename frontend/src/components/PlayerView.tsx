import { useState } from 'react'
import { api, ApiError } from '../api/client'
import type { SessionDetailOut, RoundDetailOut } from '../api/client'

// ── Types ─────────────────────────────────────────────────────────────────────

type Screen = 'join' | 'selectPlayer' | 'selectRound' | 'predict'

// ── Shared helpers ────────────────────────────────────────────────────────────

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-sm text-muted hover:text-white transition-colors mb-5"
    >
      ← Back
    </button>
  )
}

// ── Teammates grid ────────────────────────────────────────────────────────────

interface TeammatesViewProps {
  opponents: Array<{ id: number; name: string; faction: string | null }>
  submitted: Record<string, Record<string, number>>
  pending: string[]
  currentPlayer: string
}

function TeammatesView({ opponents, submitted, pending, currentPlayer }: TeammatesViewProps) {
  const submittedEntries = Object.entries(submitted)

  return (
    <div className="space-y-4 px-4 pb-4 pt-3">
      {submittedEntries.length > 0 && (
        <div>
          <p className="text-xs text-muted/70 uppercase tracking-wider mb-2">Submitted</p>
          <div className="space-y-2">
            {submittedEntries.map(([player, preds]) => (
              <div key={player} className="bg-black/20 rounded-lg p-3 border border-white/5">
                <p className="text-sm font-medium text-white mb-2">
                  {player}
                  {player === currentPlayer && (
                    <span className="ml-2 text-xs font-normal text-accent">(you)</span>
                  )}
                </p>
                <div className="grid grid-cols-5 gap-1 text-center">
                  {opponents.map(op => (
                    <div key={op.id}>
                      <p className="text-[10px] text-muted truncate leading-tight">{op.name}</p>
                      <p className="text-sm font-mono text-white font-semibold">{preds[op.name] ?? '—'}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div>
          <p className="text-xs text-muted/70 uppercase tracking-wider mb-2">
            Waiting on ({pending.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {pending.map(p => (
              <span
                key={p}
                className="text-xs text-muted bg-white/5 border border-white/10 rounded-full px-3 py-1"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PlayerView() {
  const [screen, setScreen] = useState<Screen>('join')

  // Session data (loaded after joining)
  const [sessionData, setSessionData] = useState<SessionDetailOut | null>(null)

  // Join
  const [rawCode, setRawCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)

  // Player selection
  const [selectedPlayer, setSelectedPlayer] = useState('')

  // Round selection
  const [selectedRound, setSelectedRound] = useState<RoundDetailOut | null>(null)

  // Prediction form
  const [scores, setScores] = useState<Record<string, string>>({})
  const [scoreErrors, setScoreErrors] = useState<Record<string, string>>({})
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)

  // Editing state — true when the player already has predictions for this round
  const [isEditing, setIsEditing] = useState(false)
  const [loadingPrevious, setLoadingPrevious] = useState(false)

  // Teammates panel
  const [showTeammates, setShowTeammates] = useState(false)
  const [teammatesPredictions, setTeammatesPredictions] = useState<Record<string, Record<string, number>>>({})
  const [loadingTeammates, setLoadingTeammates] = useState(false)

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleJoin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const code = rawCode.trim().toUpperCase()
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      setCodeError('Enter a valid 6-character code (letters and numbers)')
      return
    }
    setJoinLoading(true)
    setCodeError('')
    try {
      const data = await api.getSession(code)
      setSessionData(data)
      setScreen('selectPlayer')
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setCodeError('Session not found — check the code and try again.')
      } else {
        setCodeError(err instanceof ApiError ? err.message : 'Could not connect to server.')
      }
    } finally {
      setJoinLoading(false)
    }
  }

  async function handleRoundSelect(round: RoundDetailOut) {
    if (!round.opponent_team) return

    // Reset form state
    const initial: Record<string, string> = {}
    round.opponent_team.players.forEach(op => { initial[op.name] = '' })
    setSelectedRound(round)
    setScores(initial)
    setScoreErrors({})
    setSubmitError(null)
    setSubmitSuccess(null)
    setShowTeammates(false)
    setTeammatesPredictions({})
    setIsEditing(false)
    setLoadingPrevious(true)
    setScreen('predict')

    // Fetch existing predictions in the background
    try {
      const predsData = await api.getPredictions(round.id)
      setTeammatesPredictions(predsData.predictions)
      const myPreds = predsData.predictions[selectedPlayer]
      if (myPreds && Object.keys(myPreds).length > 0) {
        const filled: Record<string, string> = {}
        round.opponent_team.players.forEach(op => {
          filled[op.name] = myPreds[op.name] !== undefined ? String(myPreds[op.name]) : ''
        })
        setScores(filled)
        setIsEditing(true)
      }
    } catch {
      // non-critical — form still usable without prior data
    } finally {
      setLoadingPrevious(false)
    }
  }

  function handleScoreChange(opponentName: string, value: string) {
    setScores(prev => ({ ...prev, [opponentName]: value }))
    setScoreErrors(prev => { const e = { ...prev }; delete e[opponentName]; return e })
    setSubmitSuccess(null)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selectedRound?.opponent_team || !sessionData) return

    const opponents = selectedRound.opponent_team.players
    const errors: Record<string, string> = {}
    for (const op of opponents) {
      const raw = scores[op.name] ?? ''
      if (raw === '') { errors[op.name] = 'Required'; continue }
      const val = parseFloat(raw)
      if (isNaN(val) || val < 0 || val > 20) {
        errors[op.name] = 'Must be 0–20'
      } else if (Math.round(val * 2) !== val * 2) {
        errors[op.name] = 'Integers or .5 steps only (e.g. 12.5)'
      }
    }
    if (Object.keys(errors).length > 0) {
      setScoreErrors(errors)
      return
    }

    const parsed: Record<string, number> = {}
    for (const [k, v] of Object.entries(scores)) parsed[k] = parseFloat(v)

    const wasEditing = isEditing
    setSubmitLoading(true)
    setSubmitError(null)
    setSubmitSuccess(null)
    try {
      await api.submitPredictions(
        sessionData.code,
        selectedPlayer,
        selectedRound.round_number,
        parsed,
      )
      setIsEditing(true)
      setSubmitSuccess(wasEditing ? 'Predictions updated!' : 'Predictions submitted!')

      // Refresh teammates panel so the current player's row appears
      const predsData = await api.getPredictions(selectedRound.id)
      setTeammatesPredictions(predsData.predictions)
      // Auto-open teammates panel so they can see the full matrix
      setShowTeammates(true)
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setSubmitError(err.message)
      } else {
        setSubmitError(err instanceof ApiError ? err.message : 'Failed to submit — please try again.')
      }
    } finally {
      setSubmitLoading(false)
    }
  }

  async function loadTeammatesForPredict() {
    if (!selectedRound) return
    setLoadingTeammates(true)
    try {
      const data = await api.getPredictions(selectedRound.id)
      setTeammatesPredictions(data.predictions)
    } catch {
      // non-critical
    } finally {
      setLoadingTeammates(false)
    }
  }

  function handleToggleTeammates() {
    const next = !showTeammates
    setShowTeammates(next)
    if (next && Object.keys(teammatesPredictions).length === 0) {
      void loadTeammatesForPredict()
    }
  }

  // ── Computed ───────────────────────────────────────────────────────────────

  const teamPlayers = sessionData?.team.players.map(p => p.name) ?? []

  // After the player has submitted, include their own row in the teammates view
  const teammates_display = isEditing
    ? teammatesPredictions
    : Object.fromEntries(Object.entries(teammatesPredictions).filter(([n]) => n !== selectedPlayer))

  const pendingInTeammates = teamPlayers.filter(p => !teammates_display[p])

  // ── Screen: Join ──────────────────────────────────────────────────────────

  if (screen === 'join') {
    return (
      <div className="max-w-sm mx-auto px-4 py-16">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Join Session</h1>
          <p className="text-muted text-sm">Enter the code your captain shared with you.</p>
        </div>

        <form onSubmit={e => void handleJoin(e)} className="space-y-4">
          <div>
            <input
              type="text"
              value={rawCode}
              onChange={e => {
                setRawCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))
                setCodeError('')
              }}
              placeholder="A7X2K9"
              maxLength={6}
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
              className={`w-full text-center text-4xl font-mono tracking-[0.3em] uppercase
                bg-black/30 border rounded-xl px-4 py-5 text-white placeholder-white/15
                focus:outline-none focus:border-accent transition-colors
                ${codeError ? 'border-danger' : 'border-white/10'}`}
            />
            {codeError && (
              <p className="mt-2 text-sm text-danger text-center">{codeError}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={rawCode.length !== 6 || joinLoading}
            className="w-full py-3.5 bg-accent hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all text-base"
          >
            {joinLoading ? 'Joining…' : 'Join Session'}
          </button>
        </form>
      </div>
    )
  }

  // ── Screen: Select player ─────────────────────────────────────────────────

  if (screen === 'selectPlayer' && sessionData) {
    return (
      <div className="max-w-sm mx-auto px-4 py-10">
        <BackButton onClick={() => setScreen('join')} />

        <div className="bg-black/30 rounded-xl px-4 py-3 border border-white/10 mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted/70 uppercase tracking-widest">Session</p>
            <p className="text-lg font-mono font-bold text-accent tracking-widest">{sessionData.code}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted/70">Team</p>
            <p className="text-sm text-white font-medium">{sessionData.team.name}</p>
          </div>
        </div>

        <h2 className="text-xl font-bold text-white mb-1">Who are you?</h2>
        <p className="text-muted text-sm mb-5">Select your name from the team roster.</p>

        <form onSubmit={e => { e.preventDefault(); if (selectedPlayer) setScreen('selectRound') }}>
          <div className="space-y-2 mb-4">
            {sessionData.team.players.map(player => (
              <button
                key={player.id}
                type="button"
                onClick={() => setSelectedPlayer(player.name)}
                className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all font-medium flex items-center justify-between ${
                  selectedPlayer === player.name
                    ? 'border-accent bg-accent/10 text-white'
                    : 'border-white/10 bg-black/20 text-muted hover:border-white/25 hover:text-white'
                }`}
              >
                <span>{player.name}</span>
                {selectedPlayer === player.name && (
                  <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={!selectedPlayer}
            className="w-full py-3 bg-accent hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all"
          >
            {selectedPlayer ? `Continue as ${selectedPlayer}` : 'Select your name'}
          </button>
        </form>
      </div>
    )
  }

  // ── Screen: Select round ──────────────────────────────────────────────────

  if (screen === 'selectRound' && sessionData) {
    return (
      <div className="max-w-sm mx-auto px-4 py-10">
        <BackButton onClick={() => setScreen('selectPlayer')} />

        <div className="mb-6">
          <h2 className="text-xl font-bold text-white">Hi, {selectedPlayer}!</h2>
          <p className="text-muted text-sm mt-1">Choose a round to submit your predictions.</p>
        </div>

        <div className="space-y-3">
          {sessionData.rounds.map(round => {
            const hasOpponent = !!round.opponent_team
            return (
              <button
                key={round.id}
                onClick={() => void handleRoundSelect(round)}
                disabled={!hasOpponent}
                className={`w-full text-left rounded-xl border px-4 py-4 transition-all ${
                  hasOpponent
                    ? 'border-white/10 bg-black/20 hover:border-accent/50 hover:bg-accent/5 active:scale-[0.99]'
                    : 'border-white/5 bg-black/10 opacity-40 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-semibold text-sm ${hasOpponent ? 'text-white' : 'text-muted'}`}>
                      Round {round.round_number}
                    </p>
                    <p className="text-sm text-muted mt-0.5">
                      {hasOpponent
                        ? <span>vs <span className="text-white/80">{round.opponent_team!.name}</span></span>
                        : 'No opponent assigned yet'
                      }
                    </p>
                  </div>
                  {hasOpponent
                    ? <span className="text-muted text-base">→</span>
                    : <span className="text-[10px] text-muted/50 border border-white/10 rounded px-2 py-0.5">Locked</span>
                  }
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Screen: Predict ───────────────────────────────────────────────────────

  if (screen === 'predict' && selectedRound?.opponent_team && sessionData) {
    const opponents = selectedRound.opponent_team.players

    return (
      <div className="max-w-sm mx-auto px-4 py-10">
        <BackButton onClick={() => setScreen('selectRound')} />

        <div className="mb-5">
          <h2 className="text-xl font-bold text-white leading-tight">
            {selectedPlayer}
            <span className="text-muted font-normal"> vs </span>
            {selectedRound.opponent_team.name}
          </h2>
          <p className="text-muted text-sm mt-1">
            Round {selectedRound.round_number} · Predict your score against each opponent (0–20, half-points ok).
          </p>
        </div>

        {/* Already-submitted notice */}
        {loadingPrevious && (
          <div className="flex items-center gap-2 mb-4 text-muted/60 text-xs">
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Checking previous submissions…
          </div>
        )}

        {!loadingPrevious && isEditing && (
          <div className="mb-4 flex items-start gap-2.5 bg-accent/8 border border-accent/20 rounded-lg px-3.5 py-2.5">
            <svg className="w-4 h-4 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-accent/90">
              You submitted predictions for this round. You can update them below.
            </p>
          </div>
        )}

        {/* Success flash */}
        {submitSuccess && (
          <div className="mb-4 flex items-center gap-2.5 bg-success/10 border border-success/25 rounded-lg px-3.5 py-2.5">
            <svg className="w-4 h-4 text-success shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm text-success">{submitSuccess}</p>
          </div>
        )}

        <form onSubmit={e => void handleSubmit(e)} className="space-y-2 mb-6">
          {opponents.map(op => (
            <div
              key={op.id}
              className={`flex items-center gap-3 bg-black/30 rounded-xl px-4 py-3 border transition-colors ${
                scoreErrors[op.name] ? 'border-danger/50' : 'border-white/10'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium leading-tight">{op.name}</p>
                {op.faction && <p className="text-muted text-xs">{op.faction}</p>}
                {scoreErrors[op.name] && (
                  <p className="text-danger text-xs mt-0.5">{scoreErrors[op.name]}</p>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <input
                  type="number"
                  min="0"
                  max="20"
                  step="0.5"
                  inputMode="decimal"
                  value={scores[op.name] ?? ''}
                  onChange={e => handleScoreChange(op.name, e.target.value)}
                  placeholder="–"
                  className={`w-16 text-center bg-black/40 border rounded-lg px-1 py-2 text-white font-mono text-sm
                    focus:outline-none focus:border-accent transition-colors
                    [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                    ${scoreErrors[op.name] ? 'border-danger' : 'border-white/10 hover:border-white/25'}`}
                />
                <span className="text-muted/60 text-xs">/20</span>
              </div>
            </div>
          ))}

          {submitError && (
            <p className="text-danger text-sm py-1">{submitError}</p>
          )}

          <button
            type="submit"
            disabled={submitLoading || loadingPrevious}
            className="w-full mt-4 py-3.5 bg-accent hover:bg-accent/90 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all"
          >
            {submitLoading
              ? (isEditing ? 'Updating…' : 'Submitting…')
              : (isEditing ? 'Update Predictions' : 'Submit Predictions')
            }
          </button>
        </form>

        {/* Teammates toggle */}
        <div className="border border-white/10 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={handleToggleTeammates}
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-muted hover:text-white transition-colors"
          >
            <span>
              Team submissions · Round {selectedRound.round_number}
              {!loadingTeammates && Object.keys(teammatesPredictions).length > 0 && (
                <span className="ml-2 text-xs opacity-60">
                  ({Object.keys(teammatesPredictions).length}/5 submitted)
                </span>
              )}
            </span>
            <svg
              className={`w-4 h-4 transition-transform ${showTeammates ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showTeammates && (
            loadingTeammates ? (
              <div className="px-4 py-3 text-sm text-muted/60">Loading…</div>
            ) : (
              <TeammatesView
                opponents={opponents}
                submitted={teammates_display}
                pending={pendingInTeammates}
                currentPlayer={selectedPlayer}
              />
            )
          )}
        </div>
      </div>
    )
  }

  return null
}
