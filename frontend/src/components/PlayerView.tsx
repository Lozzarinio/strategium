import { useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

type Screen = 'join' | 'selectPlayer' | 'selectRound' | 'predict' | 'submitted'

interface OpponentPlayer {
  name: string
  faction: string
}

interface Round {
  id: number
  roundNumber: number
  opponent: { name: string; players: OpponentPlayer[] } | null
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_TEAM = {
  name: 'Fire and Dice',
  players: ['Alice', 'Bob', 'Carol', 'Dave', 'Eve'],
}

const MOCK_ROUNDS: Round[] = [
  {
    id: 1,
    roundNumber: 1,
    opponent: {
      name: 'Thunder Warriors',
      players: [
        { name: 'Enemy1', faction: 'Chaos' },
        { name: 'Enemy2', faction: 'Orks' },
        { name: 'Enemy3', faction: 'Necrons' },
        { name: 'Enemy4', faction: 'Tau' },
        { name: 'Enemy5', faction: 'Tyranids' },
      ],
    },
  },
  { id: 2, roundNumber: 2, opponent: null },
  { id: 3, roundNumber: 3, opponent: null },
]

// Pre-existing mock submissions from teammates
const MOCK_PRE_SUBMITTED: Record<string, Record<string, number>> = {
  Bob: { Enemy1: 12, Enemy2: 15, Enemy3: 10, Enemy4: 18, Enemy5: 14 },
  Carol: { Enemy1: 16, Enemy2: 11, Enemy3: 13, Enemy4: 15, Enemy5: 12 },
}

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

// ── Teammates grid (reused in predict + submitted screens) ────────────────────

interface TeammatesViewProps {
  opponents: OpponentPlayer[]
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
                    <div key={op.name}>
                      <p className="text-[10px] text-muted truncate leading-tight">{op.name}</p>
                      <p className="text-sm font-mono text-white font-semibold">{preds[op.name]}</p>
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

  // Join
  const [rawCode, setRawCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [sessionCode, setSessionCode] = useState('')

  // Player selection
  const [selectedPlayer, setSelectedPlayer] = useState('')

  // Prediction
  const [selectedRound, setSelectedRound] = useState<Round | null>(null)
  const [scores, setScores] = useState<Record<string, string>>({})
  const [scoreErrors, setScoreErrors] = useState<Record<string, string>>({})
  const [submittedScores, setSubmittedScores] = useState<Record<string, number>>({})
  const [showTeammates, setShowTeammates] = useState(false)

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleJoin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const code = rawCode.trim().toUpperCase()
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      setCodeError('Enter a valid 6-character code (letters and numbers)')
      return
    }
    setSessionCode(code)
    setScreen('selectPlayer')
  }

  function handleRoundSelect(round: Round) {
    if (!round.opponent) return
    setSelectedRound(round)
    const initial: Record<string, string> = {}
    round.opponent.players.forEach(op => { initial[op.name] = '' })
    setScores(initial)
    setScoreErrors({})
    setShowTeammates(false)
    setScreen('predict')
  }

  function handleScoreChange(opponentName: string, value: string) {
    setScores(prev => ({ ...prev, [opponentName]: value }))
    setScoreErrors(prev => { const e = { ...prev }; delete e[opponentName]; return e })
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selectedRound?.opponent) return

    const errors: Record<string, string> = {}
    for (const op of selectedRound.opponent.players) {
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
    setSubmittedScores(parsed)
    setScreen('submitted')
  }

  // Players pending at time of prediction (before current player submits)
  const preSubmittedNames = Object.keys(MOCK_PRE_SUBMITTED)
  const pendingBeforeSubmit = MOCK_TEAM.players.filter(
    p => p !== selectedPlayer && !preSubmittedNames.includes(p)
  )
  // Players still pending after current player submits
  const pendingAfterSubmit = MOCK_TEAM.players.filter(
    p => p !== selectedPlayer && !preSubmittedNames.includes(p)
  )

  // ── Screen: Join ─────────────────────────────────────────────────────────────

  if (screen === 'join') {
    return (
      <div className="max-w-sm mx-auto px-4 py-16">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Join Session</h1>
          <p className="text-muted text-sm">Enter the code your captain shared with you.</p>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
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
            disabled={rawCode.length !== 6}
            className="w-full py-3.5 bg-accent hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all text-base"
          >
            Join Session
          </button>
        </form>
      </div>
    )
  }

  // ── Screen: Select player ─────────────────────────────────────────────────────

  if (screen === 'selectPlayer') {
    return (
      <div className="max-w-sm mx-auto px-4 py-10">
        <BackButton onClick={() => setScreen('join')} />

        {/* Session badge */}
        <div className="bg-black/30 rounded-xl px-4 py-3 border border-white/10 mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted/70 uppercase tracking-widest">Session</p>
            <p className="text-lg font-mono font-bold text-accent tracking-widest">{sessionCode}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted/70">Team</p>
            <p className="text-sm text-white font-medium">{MOCK_TEAM.name}</p>
          </div>
        </div>

        <h2 className="text-xl font-bold text-white mb-1">Who are you?</h2>
        <p className="text-muted text-sm mb-5">Select your name from the team roster.</p>

        <form onSubmit={e => { e.preventDefault(); if (selectedPlayer) setScreen('selectRound') }}>
          <div className="space-y-2 mb-4">
            {MOCK_TEAM.players.map(player => (
              <button
                key={player}
                type="button"
                onClick={() => setSelectedPlayer(player)}
                className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all font-medium flex items-center justify-between ${
                  selectedPlayer === player
                    ? 'border-accent bg-accent/10 text-white'
                    : 'border-white/10 bg-black/20 text-muted hover:border-white/25 hover:text-white'
                }`}
              >
                <span>{player}</span>
                {selectedPlayer === player && (
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

  // ── Screen: Select round ──────────────────────────────────────────────────────

  if (screen === 'selectRound') {
    return (
      <div className="max-w-sm mx-auto px-4 py-10">
        <BackButton onClick={() => setScreen('selectPlayer')} />

        <div className="mb-6">
          <h2 className="text-xl font-bold text-white">Hi, {selectedPlayer}!</h2>
          <p className="text-muted text-sm mt-1">Choose a round to submit your predictions.</p>
        </div>

        <div className="space-y-3">
          {MOCK_ROUNDS.map(round => {
            const hasOpponent = !!round.opponent
            return (
              <button
                key={round.id}
                onClick={() => handleRoundSelect(round)}
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
                      Round {round.roundNumber}
                    </p>
                    <p className="text-sm text-muted mt-0.5">
                      {hasOpponent
                        ? <span>vs <span className="text-white/80">{round.opponent!.name}</span></span>
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

  // ── Screen: Predict ───────────────────────────────────────────────────────────

  if (screen === 'predict' && selectedRound?.opponent) {
    return (
      <div className="max-w-sm mx-auto px-4 py-10">
        <BackButton onClick={() => setScreen('selectRound')} />

        <div className="mb-5">
          <h2 className="text-xl font-bold text-white leading-tight">
            {selectedPlayer}
            <span className="text-muted font-normal"> vs </span>
            {selectedRound.opponent.name}
          </h2>
          <p className="text-muted text-sm mt-1">
            Round {selectedRound.roundNumber} · Predict your score against each opponent (0–20, half-points ok).
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2 mb-6">
          {selectedRound.opponent.players.map(op => (
            <div
              key={op.name}
              className={`flex items-center gap-3 bg-black/30 rounded-xl px-4 py-3 border transition-colors ${
                scoreErrors[op.name] ? 'border-danger/50' : 'border-white/10'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium leading-tight">{op.name}</p>
                <p className="text-muted text-xs">{op.faction}</p>
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

          <button
            type="submit"
            className="w-full mt-4 py-3.5 bg-accent hover:bg-accent/90 active:scale-[0.99] text-white font-semibold rounded-lg transition-all"
          >
            Submit Predictions
          </button>
        </form>

        {/* Teammates toggle */}
        <div className="border border-white/10 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowTeammates(p => !p)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-muted hover:text-white transition-colors"
          >
            <span>
              Team submissions · Round {selectedRound.roundNumber}
              <span className="ml-2 text-xs opacity-60">
                ({preSubmittedNames.length}/5 submitted)
              </span>
            </span>
            <svg
              className={`w-4 h-4 transition-transform ${showTeammates ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showTeammates && (
            <TeammatesView
              opponents={selectedRound.opponent.players}
              submitted={MOCK_PRE_SUBMITTED}
              pending={pendingBeforeSubmit}
              currentPlayer={selectedPlayer}
            />
          )}
        </div>
      </div>
    )
  }

  // ── Screen: Submitted ─────────────────────────────────────────────────────────

  if (screen === 'submitted' && selectedRound?.opponent) {
    const allSubmitted = { ...MOCK_PRE_SUBMITTED, [selectedPlayer]: submittedScores }

    return (
      <div className="max-w-sm mx-auto px-4 py-10">
        {/* Success header */}
        <div className="text-center mb-7">
          <div className="w-14 h-14 rounded-full bg-success/20 border border-success/40 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">Predictions Submitted!</h2>
          <p className="text-muted text-sm">
            {selectedPlayer} · Round {selectedRound.roundNumber} vs {selectedRound.opponent.name}
          </p>
        </div>

        {/* Your predictions read-only */}
        <div className="bg-black/30 rounded-xl border border-white/10 overflow-hidden mb-5">
          <div className="px-4 py-2.5 border-b border-white/10">
            <p className="text-sm font-semibold text-white">Your Predictions</p>
          </div>
          {selectedRound.opponent.players.map(op => (
            <div
              key={op.name}
              className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 last:border-0"
            >
              <div>
                <span className="text-white text-sm">{op.name}</span>
                <span className="text-muted text-xs ml-2">{op.faction}</span>
              </div>
              <span className="font-mono font-bold text-accent">
                {submittedScores[op.name]}
                <span className="text-muted/60 font-normal text-xs"> /20</span>
              </span>
            </div>
          ))}
        </div>

        {/* Full team status */}
        <div className="border border-white/10 rounded-xl overflow-hidden mb-5">
          <div className="px-4 py-2.5 border-b border-white/10">
            <p className="text-sm font-semibold text-white">
              Team Status
              <span className="ml-2 text-xs font-normal text-muted">
                ({Object.keys(allSubmitted).length}/5 submitted)
              </span>
            </p>
          </div>
          <TeammatesView
            opponents={selectedRound.opponent.players}
            submitted={allSubmitted}
            pending={pendingAfterSubmit}
            currentPlayer={selectedPlayer}
          />
        </div>

        <button
          onClick={() => setScreen('selectRound')}
          className="w-full py-3 border border-white/15 hover:border-white/30 text-white rounded-lg transition-colors text-sm"
        >
          ← Back to Rounds
        </button>
      </div>
    )
  }

  return null
}
