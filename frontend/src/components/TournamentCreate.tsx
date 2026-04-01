import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTournaments } from '../store/TournamentContext'

interface PlayerInput {
  name: string
  faction: string
  email: string
}

interface FormState {
  tournamentName: string
  numRounds: string
  teamName: string
  players: PlayerInput[]
}

interface FormErrors {
  tournamentName?: string
  teamName?: string
  players: Array<string | undefined>
}

const emptyPlayer = (): PlayerInput => ({ name: '', faction: '', email: '' })

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('')
}

function validate(form: FormState): FormErrors | null {
  const errors: FormErrors = { players: Array(5).fill(undefined) }
  let hasErrors = false

  if (!form.tournamentName.trim()) {
    errors.tournamentName = 'Tournament name is required'
    hasErrors = true
  }
  if (!form.teamName.trim()) {
    errors.teamName = 'Team name is required'
    hasErrors = true
  }
  form.players.forEach((p, i) => {
    if (!p.name.trim()) {
      errors.players[i] = 'Player name is required'
      hasErrors = true
    }
  })

  return hasErrors ? errors : null
}

// Shared input class builder
const inputClass = (hasError?: boolean) =>
  `w-full bg-black/30 border rounded-lg px-3 py-2.5 text-white placeholder-white/20
   focus:outline-none focus:border-accent transition-colors text-sm
   ${hasError ? 'border-danger' : 'border-white/10 hover:border-white/20'}`

export default function TournamentCreate() {
  const { addTournament } = useTournaments()

  const [form, setForm] = useState<FormState>({
    tournamentName: '',
    numRounds: '3',
    teamName: '',
    players: Array.from({ length: 5 }, emptyPlayer),
  })
  const [errors, setErrors] = useState<FormErrors>({ players: Array(5).fill(undefined) })
  const [sessionCode, setSessionCode] = useState<string | null>(null)
  const [createdId, setCreatedId] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  function clearFieldError(field: keyof Omit<FormErrors, 'players'>) {
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  function updatePlayer(index: number, field: keyof PlayerInput, value: string) {
    setForm(prev => ({
      ...prev,
      players: prev.players.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
    }))
    if (field === 'name') {
      setErrors(prev => ({
        ...prev,
        players: prev.players.map((e, i) => (i === index ? undefined : e)),
      }))
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validationErrors = validate(form)
    if (validationErrors) {
      setErrors(validationErrors)
      // Scroll to first error
      document.querySelector('[data-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    const code = generateCode()
    const tournament = addTournament({
      name: form.tournamentName.trim(),
      num_rounds: parseInt(form.numRounds),
      team_name: form.teamName.trim(),
      players: form.players.map(p => ({
        name: p.name.trim(),
        faction: p.faction.trim(),
        email: p.email.trim(),
      })),
      session_code: code,
    })
    setCreatedId(tournament.id)
    setSessionCode(code)
  }

  async function handleCopy() {
    if (!sessionCode) return
    await navigator.clipboard.writeText(sessionCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (sessionCode) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="bg-black/30 rounded-2xl p-8 border border-white/10">
          <div className="w-16 h-16 rounded-full bg-success/20 border border-success/40 flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">Tournament Created!</h1>
          <p className="text-muted text-sm mb-8">
            Share this code with your team so they can join and submit predictions.
          </p>

          <div className="bg-black/50 rounded-xl p-6 mb-6 border border-white/10">
            <p className="text-xs text-muted uppercase tracking-widest mb-3">Session Code</p>
            <p className="text-5xl font-mono font-bold tracking-[0.25em] text-accent select-all">
              {sessionCode}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleCopy}
              className="flex-1 py-3 px-5 rounded-lg border border-accent/60 text-accent hover:bg-accent/10 transition-colors font-medium text-sm"
            >
              {copied ? '✓ Copied!' : 'Copy Code'}
            </button>
            <Link
              to={`/tournament/${createdId}`}
              className="flex-1 py-3 px-5 rounded-lg bg-accent hover:bg-accent/90 text-white font-medium text-sm text-center transition-colors"
            >
              Go to Dashboard →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-1">Create Tournament</h1>
        <p className="text-muted text-sm">
          Set up your team and get a session code to share with your players.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">

        {/* ── Tournament details ─────────────────────────────────────────── */}
        <section className="bg-black/30 rounded-xl p-5 border border-white/10 space-y-4">
          <h2 className="text-base font-semibold text-white">Tournament Details</h2>

          <div data-error={errors.tournamentName ? '' : undefined}>
            <label className="block text-sm text-muted mb-1.5">
              Tournament Name <span className="text-accent">*</span>
            </label>
            <input
              type="text"
              value={form.tournamentName}
              onChange={e => {
                setForm(prev => ({ ...prev, tournamentName: e.target.value }))
                clearFieldError('tournamentName')
              }}
              placeholder="e.g. Bay Area Bash 2026"
              className={inputClass(!!errors.tournamentName)}
            />
            {errors.tournamentName && (
              <p className="mt-1.5 text-xs text-danger">{errors.tournamentName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm text-muted mb-1.5">Number of Rounds</label>
            <select
              value={form.numRounds}
              onChange={e => setForm(prev => ({ ...prev, numRounds: e.target.value }))}
              className="bg-surface border border-white/10 hover:border-white/20 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent transition-colors"
            >
              {[1, 2, 3, 4, 5].map(n => (
                <option key={n} value={n} className="bg-surface">{n} round{n !== 1 ? 's' : ''}</option>
              ))}
            </select>
          </div>
        </section>

        {/* ── Team details ───────────────────────────────────────────────── */}
        <section className="bg-black/30 rounded-xl p-5 border border-white/10 space-y-4">
          <h2 className="text-base font-semibold text-white">Your Team</h2>

          <div data-error={errors.teamName ? '' : undefined}>
            <label className="block text-sm text-muted mb-1.5">
              Team Name <span className="text-accent">*</span>
            </label>
            <input
              type="text"
              value={form.teamName}
              onChange={e => {
                setForm(prev => ({ ...prev, teamName: e.target.value }))
                clearFieldError('teamName')
              }}
              placeholder="e.g. Fire and Dice"
              className={inputClass(!!errors.teamName)}
            />
            {errors.teamName && (
              <p className="mt-1.5 text-xs text-danger">{errors.teamName}</p>
            )}
          </div>

          {/* Column headers — desktop only */}
          <div className="hidden sm:grid sm:grid-cols-[1fr_1fr_1fr] gap-2 px-0.5">
            <span className="text-xs text-muted/70 uppercase tracking-wide">
              Name <span className="text-accent">*</span>
            </span>
            <span className="text-xs text-muted/70 uppercase tracking-wide">Faction</span>
            <span className="text-xs text-muted/70 uppercase tracking-wide">Email</span>
          </div>

          {/* Player rows */}
          <div className="space-y-2">
            {form.players.map((player, i) => (
              <div
                key={i}
                data-error={errors.players[i] ? '' : undefined}
                className={`rounded-lg border p-3 transition-colors ${
                  errors.players[i]
                    ? 'border-danger/40 bg-danger/5'
                    : 'border-white/5 bg-black/20'
                }`}
              >
                {/* Mobile: label */}
                <p className="text-xs font-medium text-muted mb-2 sm:hidden">
                  Player {i + 1}
                </p>

                <div className="sm:grid sm:grid-cols-[1fr_1fr_1fr] sm:gap-2 space-y-2 sm:space-y-0">
                  <div>
                    <input
                      type="text"
                      value={player.name}
                      onChange={e => updatePlayer(i, 'name', e.target.value)}
                      placeholder={`Player ${i + 1} name`}
                      className={inputClass(!!errors.players[i])}
                    />
                    {errors.players[i] && (
                      <p className="mt-1 text-xs text-danger">{errors.players[i]}</p>
                    )}
                  </div>
                  <input
                    type="text"
                    value={player.faction}
                    onChange={e => updatePlayer(i, 'faction', e.target.value)}
                    placeholder="Faction (optional)"
                    className={inputClass()}
                  />
                  <input
                    type="email"
                    value={player.email}
                    onChange={e => updatePlayer(i, 'email', e.target.value)}
                    placeholder="Email (optional)"
                    className={inputClass()}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted/60 flex items-start gap-1.5">
            <span className="text-warning mt-px">⚠</span>
            Player names are locked after creation and cannot be changed.
          </p>
        </section>

        <button
          type="submit"
          className="w-full py-3 px-6 bg-accent hover:bg-accent/90 active:scale-[0.99] text-white font-semibold rounded-lg transition-all"
        >
          Create Tournament
        </button>
      </form>
    </div>
  )
}
