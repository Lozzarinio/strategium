import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type { TournamentOut, OpponentTeamOut, RoundOut } from '../api/client'

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputCls = (err?: boolean) =>
  `w-full bg-black/30 border rounded-lg px-3 py-2 text-white text-sm placeholder-white/20
   focus:outline-none focus:border-accent transition-colors
   ${err ? 'border-danger' : 'border-white/10 hover:border-white/20'}`

interface OpponentPlayerInput {
  name: string
  faction: string
  notes: string
}

const emptyPlayer = (): OpponentPlayerInput => ({ name: '', faction: '', notes: '' })

// ── Main component ────────────────────────────────────────────────────────────

export default function TournamentDashboard() {
  const { id } = useParams<{ id: string }>()

  const [tournament, setTournament] = useState<TournamentOut | null>(null)
  const [opponents, setOpponents] = useState<OpponentTeamOut[]>([])
  const [rounds, setRounds] = useState<RoundOut[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [expandedTeam, setExpandedTeam] = useState<number | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [copied, setCopied] = useState(false)

  // Add opponent form state
  const [newName, setNewName] = useState('')
  const [newPlayers, setNewPlayers] = useState<OpponentPlayerInput[]>(Array.from({ length: 5 }, emptyPlayer))
  const [formErrors, setFormErrors] = useState<{ name?: string; players: Array<string | undefined> }>({
    players: Array(5).fill(undefined),
  })
  const [savingTeam, setSavingTeam] = useState(false)
  const [saveTeamError, setSaveTeamError] = useState<string | null>(null)

  // Round assignment state
  const [assigningRound, setAssigningRound] = useState<number | null>(null)

  // ── Load tournament on mount ──────────────────────────────────────────────

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setLoadError(null)

    Promise.all([
      api.getTournament(id),
      api.getOpponentTeams(id),
    ])
      .then(([t, opps]) => {
        setTournament(t)
        setOpponents(opps)
        setRounds(t.session.rounds)
      })
      .catch(err => {
        setLoadError(
          err instanceof ApiError ? err.message : 'Failed to load tournament — is the backend running?'
        )
      })
      .finally(() => setLoading(false))
  }, [id])

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleCopy() {
    if (!tournament) return
    navigator.clipboard.writeText(tournament.session.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function updateNewPlayer(i: number, field: keyof OpponentPlayerInput, val: string) {
    setNewPlayers(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: val } : p))
    if (field === 'name') {
      setFormErrors(prev => ({
        ...prev,
        players: prev.players.map((e, idx) => idx === i ? undefined : e),
      }))
    }
  }

  async function handleSaveTeam(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const errors: typeof formErrors = { players: Array(5).fill(undefined) }
    let bad = false
    if (!newName.trim()) { errors.name = 'Team name is required'; bad = true }
    newPlayers.forEach((p, i) => {
      if (!p.name.trim()) { errors.players[i] = 'Required'; bad = true }
    })
    if (bad) { setFormErrors(errors); return }
    if (!id) return

    setSavingTeam(true)
    setSaveTeamError(null)
    try {
      const team = await api.createOpponentTeam(id, {
        name: newName.trim(),
        players: newPlayers.map(p => ({
          name: p.name.trim(),
          faction: p.faction.trim() || undefined,
          notes: p.notes.trim() || undefined,
        })),
      })
      setOpponents(prev => [...prev, team])
      setExpandedTeam(team.id)
      setShowAddForm(false)
      setNewName('')
      setNewPlayers(Array.from({ length: 5 }, emptyPlayer))
      setFormErrors({ players: Array(5).fill(undefined) })
    } catch (err) {
      setSaveTeamError(
        err instanceof ApiError ? err.message : 'Failed to save team — please try again.'
      )
    } finally {
      setSavingTeam(false)
    }
  }

  async function assignOpponent(roundId: number, value: string) {
    setAssigningRound(roundId)
    const opponentTeamId = value ? Number(value) : null
    try {
      const updated = await api.updateRound(roundId, { opponent_team_id: opponentTeamId })
      setRounds(prev => prev.map(r => r.id === roundId ? { ...r, opponent_team_id: updated.opponent_team_id } : r))
    } catch (err) {
      // On failure, leave the round unchanged — the dropdown will revert on next render
      console.error('Failed to assign opponent:', err)
    } finally {
      setAssigningRound(null)
    }
  }

  // ── Loading / error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="flex items-center justify-center gap-3 text-muted">
          <svg className="w-5 h-5 animate-spin text-accent" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Loading tournament…
        </div>
      </div>
    )
  }

  if (loadError || !tournament) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-danger mb-4">{loadError ?? 'Tournament not found.'}</p>
        <Link to="/" className="text-accent hover:underline text-sm">← Back to Home</Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="bg-black/30 rounded-xl p-5 border border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <p className="text-xs text-muted/70 uppercase tracking-widest mb-1">Tournament</p>
            <h1 className="text-2xl font-bold text-white leading-tight">{tournament.name}</h1>
            <p className="text-muted text-sm mt-0.5">{tournament.team.name}</p>
          </div>

          {/* Session code */}
          <div className="flex items-center gap-3 bg-black/40 rounded-xl px-4 py-3 border border-white/10 self-start">
            <div>
              <p className="text-[10px] text-muted/60 uppercase tracking-widest leading-none mb-1">
                Session Code
              </p>
              <p className="text-2xl font-mono font-bold tracking-[0.2em] text-accent">
                {tournament.session.code}
              </p>
            </div>
            <button
              onClick={handleCopy}
              className="ml-2 px-3 py-1.5 text-xs rounded-lg border border-accent/50 text-accent hover:bg-accent/10 transition-colors font-medium whitespace-nowrap"
            >
              {copied ? '✓ Copied' : 'Copy Code'}
            </button>
          </div>
        </div>

        {/* Players */}
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-xs text-muted/70 uppercase tracking-wide mb-2.5">Your Players</p>
          <div className="flex flex-wrap gap-2">
            {tournament.team.players.map(p => (
              <div
                key={p.id}
                className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5 border border-white/10"
              >
                <span className="text-white text-sm font-medium">{p.name}</span>
                {p.faction && <span className="text-muted/60 text-xs">{p.faction}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── OPPONENT TEAMS ────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-white">
            Opponent Teams
            <span className="ml-2 text-sm font-normal text-muted">({opponents.length})</span>
          </h2>
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="text-sm px-3 py-1.5 rounded-lg border border-accent/50 text-accent hover:bg-accent/10 transition-colors font-medium"
            >
              + Add Opponent Team
            </button>
          )}
        </div>

        <div className="space-y-2">
          {opponents.map(team => {
            const isOpen = expandedTeam === team.id
            return (
              <div key={team.id} className="bg-black/30 rounded-xl border border-white/10 overflow-hidden">
                <button
                  onClick={() => setExpandedTeam(isOpen ? null : team.id)}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/5 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-white">{team.name}</span>
                    <span className="text-xs text-muted bg-white/10 rounded-full px-2 py-0.5">
                      {team.players.length} players
                    </span>
                  </div>
                  <svg
                    className={`w-4 h-4 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isOpen && (
                  <div className="border-t border-white/10 px-4 py-3">
                    <div className="hidden sm:grid sm:grid-cols-[1fr_1fr_1fr] gap-2 mb-2 px-0.5">
                      <span className="text-xs text-muted/60 uppercase tracking-wide">Name</span>
                      <span className="text-xs text-muted/60 uppercase tracking-wide">Faction</span>
                      <span className="text-xs text-muted/60 uppercase tracking-wide">Notes</span>
                    </div>
                    <div className="space-y-1.5">
                      {team.players.map((p) => (
                        <div
                          key={p.id}
                          className="sm:grid sm:grid-cols-[1fr_1fr_1fr] sm:gap-2 sm:items-center
                            space-y-0.5 sm:space-y-0 py-1.5 sm:py-1 border-b border-white/5 last:border-0"
                        >
                          <span className="text-sm text-white font-medium">{p.name}</span>
                          <span className="text-sm text-muted">{p.faction || '—'}</span>
                          <span className="text-xs text-muted/60 italic">{p.notes || ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ── Add Opponent Team form ────────────────────────────────────────── */}
        {showAddForm && (
          <form
            onSubmit={handleSaveTeam}
            className="mt-3 bg-black/30 rounded-xl border border-accent/30 p-5 space-y-4"
          >
            <h3 className="text-sm font-semibold text-white">New Opponent Team</h3>

            {saveTeamError && (
              <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
                {saveTeamError}
              </p>
            )}

            <div>
              <label className="block text-xs text-muted mb-1.5">
                Team Name <span className="text-accent">*</span>
              </label>
              <input
                type="text"
                value={newName}
                onChange={e => { setNewName(e.target.value); setFormErrors(p => ({ ...p, name: undefined })) }}
                placeholder="e.g. Thunder Warriors"
                className={inputCls(!!formErrors.name)}
              />
              {formErrors.name && <p className="mt-1 text-xs text-danger">{formErrors.name}</p>}
            </div>

            <div>
              <div className="hidden sm:grid sm:grid-cols-[1fr_1fr_1.5fr] gap-2 mb-2 px-0.5">
                <span className="text-xs text-muted/60 uppercase tracking-wide">
                  Name <span className="text-accent">*</span>
                </span>
                <span className="text-xs text-muted/60 uppercase tracking-wide">Faction</span>
                <span className="text-xs text-muted/60 uppercase tracking-wide">Notes</span>
              </div>

              <div className="space-y-2">
                {newPlayers.map((p, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border p-2.5 transition-colors
                      ${formErrors.players[i] ? 'border-danger/40 bg-danger/5' : 'border-white/5 bg-black/20'}`}
                  >
                    <p className="text-xs text-muted mb-1.5 sm:hidden">Player {i + 1}</p>
                    <div className="sm:grid sm:grid-cols-[1fr_1fr_1.5fr] sm:gap-2 space-y-1.5 sm:space-y-0">
                      <div>
                        <input
                          type="text"
                          value={p.name}
                          onChange={e => updateNewPlayer(i, 'name', e.target.value)}
                          placeholder={`Player ${i + 1}`}
                          className={inputCls(!!formErrors.players[i])}
                        />
                        {formErrors.players[i] && (
                          <p className="mt-0.5 text-xs text-danger">{formErrors.players[i]}</p>
                        )}
                      </div>
                      <input
                        type="text"
                        value={p.faction}
                        onChange={e => updateNewPlayer(i, 'faction', e.target.value)}
                        placeholder="Faction"
                        className={inputCls()}
                      />
                      <input
                        type="text"
                        value={p.notes}
                        onChange={e => updateNewPlayer(i, 'notes', e.target.value)}
                        placeholder="Notes (optional)"
                        className={inputCls()}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={savingTeam}
                className="px-4 py-2 bg-accent hover:bg-accent/90 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {savingTeam ? 'Saving…' : 'Save Team'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false)
                  setNewName('')
                  setNewPlayers(Array.from({ length: 5 }, emptyPlayer))
                  setFormErrors({ players: Array(5).fill(undefined) })
                  setSaveTeamError(null)
                }}
                className="px-4 py-2 border border-white/10 hover:border-white/25 text-muted hover:text-white text-sm rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>

      {/* ── ROUNDS ──────────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-white mb-3">Rounds</h2>
        <div className="space-y-3">
          {rounds.map(round => {
            const assigned = opponents.find(o => o.id === round.opponent_team_id)
            const isAssigning = assigningRound === round.id
            return (
              <div
                key={round.id}
                className="bg-black/30 rounded-xl border border-white/10 px-4 py-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">Round {round.round_number}</p>
                    <p className="text-sm text-muted mt-0.5">
                      {assigned
                        ? <span>vs <span className="text-white/80">{assigned.name}</span></span>
                        : 'No opponent assigned'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={round.opponent_team_id ?? ''}
                      onChange={e => assignOpponent(round.id, e.target.value)}
                      disabled={isAssigning}
                      className="bg-surface border border-white/10 hover:border-white/25 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent transition-colors disabled:opacity-60"
                    >
                      <option value="" className="bg-surface">No opponent</option>
                      {opponents.map(o => (
                        <option key={o.id} value={o.id} className="bg-surface">{o.name}</option>
                      ))}
                    </select>

                    {assigned ? (
                      <Link
                        to={`/tournament/${id}/round/${round.id}`}
                        className="px-3 py-2 text-sm rounded-lg bg-white/10 hover:bg-white/15 text-white transition-colors whitespace-nowrap"
                      >
                        View Round →
                      </Link>
                    ) : (
                      <span
                        title="Assign an opponent team first"
                        className="px-3 py-2 text-sm rounded-lg bg-white/5 text-muted/40 cursor-not-allowed whitespace-nowrap"
                      >
                        View Round →
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

    </div>
  )
}
