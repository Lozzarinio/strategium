import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../api/client'
import type { TournamentOut } from '../api/client'
import { getMyTournamentIds, removeMyTournamentIds } from '../hooks/useOwnership'

export default function CaptainDashboard() {
  const location = useLocation()
  const redirectMessage = (location.state as { message?: string } | null)?.message

  const [tournaments, setTournaments] = useState<TournamentOut[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ids = getMyTournamentIds()
    if (ids.length === 0) {
      setLoading(false)
      return
    }
    Promise.allSettled(ids.map(id => api.getTournament(id)))
      .then(results => {
        const found: TournamentOut[] = []
        const missingIds: number[] = []
        results.forEach((result, i) => {
          if (result.status === 'fulfilled') {
            found.push(result.value)
          } else {
            missingIds.push(ids[i])
          }
        })
        removeMyTournamentIds(missingIds)
        // Sort by id descending (newest first)
        found.sort((a, b) => b.id - a.id)
        setTournaments(found)
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">My Tournaments</h1>
          <p className="text-muted text-sm">Tournaments you've created on this device.</p>
        </div>
        <Link
          to="/captain/create"
          className="px-4 py-2.5 bg-accent hover:bg-accent/90 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          + New Tournament
        </Link>
      </div>

      {redirectMessage && (
        <div className="mb-6 bg-warning/10 border border-warning/30 rounded-lg px-4 py-3 text-sm text-warning">
          {redirectMessage}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 text-muted">
          <svg className="w-4 h-4 animate-spin text-accent" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span className="text-sm">Loading…</span>
        </div>
      )}

      {!loading && tournaments.length === 0 && (
        <div className="bg-black/30 rounded-xl border border-white/10 p-10 text-center">
          <p className="text-muted text-sm mb-2">No tournaments found on this device.</p>
          <p className="text-muted/50 text-xs mb-6">
            Tournaments are tracked per browser. Create one to get started.
          </p>
          <Link
            to="/captain/create"
            className="inline-block px-5 py-2.5 bg-accent hover:bg-accent/90 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Create your first tournament
          </Link>
        </div>
      )}

      {!loading && tournaments.length > 0 && (
        <div className="space-y-3">
          {tournaments.map(t => (
            <Link
              key={t.id}
              to={`/tournament/${t.id}`}
              className="block bg-black/30 rounded-xl border border-white/10 hover:border-white/20 px-5 py-4 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-semibold group-hover:text-accent transition-colors">
                    {t.name}
                  </p>
                  <p className="text-muted/60 text-xs mt-0.5">
                    {t.team.name} · {t.session.rounds.length} round{t.session.rounds.length !== 1 ? 's' : ''} · Code: <span className="font-mono">{t.session.code}</span>
                  </p>
                </div>
                <span className="text-muted text-sm">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
