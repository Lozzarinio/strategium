import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { setCaptainAccess } from '../hooks/useCaptainAccess'
import { writeTournamentCache } from '../hooks/useTournamentCache'

export default function CaptainDashboard() {
  const location = useLocation()
  const navigate = useNavigate()
  const redirectMessage = (location.state as { message?: string } | null)?.message

  const [code, setCode] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const canSubmit = code.length === 6 && pin.length === 4

  async function handleAccess(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    try {
      const tournament = await api.captainAuth(code, pin)
      setCaptainAccess(tournament.id, code)
      writeTournamentCache(tournament.id, tournament)
      navigate(`/tournament/${tournament.id}`)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Invalid PIN')
      } else if (err instanceof ApiError && err.status === 404) {
        setError('Tournament not found')
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to access tournament.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-white mb-1">Captain Access</h1>
        <p className="text-muted text-sm">Create a new tournament or access an existing one.</p>
      </div>

      {redirectMessage && (
        <div className="mb-6 bg-warning/10 border border-warning/30 rounded-lg px-4 py-3 text-sm text-warning">
          {redirectMessage}
        </div>
      )}

      <Link
        to="/captain/create"
        className="block w-full text-center py-3.5 mb-8 bg-accent hover:bg-accent/90
          text-white font-semibold rounded-lg transition-colors"
      >
        + Create New Tournament
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-xs text-muted/60 uppercase tracking-widest">or</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      <div className="bg-black/30 rounded-xl border border-white/10 p-6">
        <h2 className="text-base font-semibold text-white mb-1">Access Existing Tournament</h2>
        <p className="text-muted text-sm mb-5">
          Enter your session code and tournament PIN.
        </p>

        <form onSubmit={e => void handleAccess(e)} className="space-y-4">
          <div>
            <label className="block text-sm text-muted mb-1.5">Session Code</label>
            <input
              type="text"
              value={code}
              onChange={e => {
                setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))
                setError(null)
              }}
              placeholder="A7X2K9"
              maxLength={6}
              autoComplete="off"
              autoCapitalize="characters"
              className="w-full text-center text-2xl font-mono tracking-[0.25em] uppercase
                bg-black/30 border border-white/10 rounded-lg px-3 py-3 text-white placeholder-white/15
                focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-muted mb-1.5">Tournament PIN</label>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={e => {
                setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))
                setError(null)
              }}
              placeholder="••••"
              maxLength={4}
              autoComplete="off"
              className="w-full text-center text-2xl font-mono tracking-[0.4em]
                bg-black/30 border border-white/10 rounded-lg px-3 py-3 text-white placeholder-white/15
                focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          {error && (
            <p className="text-danger text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={!canSubmit || loading}
            className="w-full py-3 bg-accent hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed
              text-white font-semibold rounded-lg transition-all"
          >
            {loading ? 'Checking…' : 'Access Tournament'}
          </button>
        </form>
      </div>
    </div>
  )
}
