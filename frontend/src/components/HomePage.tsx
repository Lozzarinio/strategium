import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type { TournamentListItem } from '../api/client'

export default function HomePage() {
  const [tournaments, setTournaments] = useState<TournamentListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getTournaments()
      .then(setTournaments)
      .catch(err => {
        setError(err instanceof ApiError ? err.message : 'Failed to load tournaments')
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Tournaments</h1>
          <p className="text-muted text-sm">Manage your Warhammer 40K team tournament pairings.</p>
        </div>
        <Link
          to="/tournament/create"
          className="px-4 py-2.5 bg-accent hover:bg-accent/90 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          + New Tournament
        </Link>
      </div>

      {loading && (
        <div className="flex items-center gap-3 text-muted">
          <svg className="w-4 h-4 animate-spin text-accent" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span className="text-sm">Loading tournaments…</span>
        </div>
      )}

      {error && (
        <p className="text-danger text-sm">{error}</p>
      )}

      {!loading && !error && tournaments.length === 0 && (
        <div className="bg-black/30 rounded-xl border border-white/10 p-8 text-center">
          <p className="text-muted text-sm mb-4">No tournaments yet.</p>
          <Link
            to="/tournament/create"
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
                <p className="text-white font-semibold group-hover:text-accent transition-colors">
                  {t.name}
                </p>
                <span className="text-muted text-sm">→</span>
              </div>
              <p className="text-muted/60 text-xs mt-1">
                {new Date(t.created_at).toLocaleDateString(undefined, {
                  year: 'numeric', month: 'short', day: 'numeric',
                })}
              </p>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-12 pt-8 border-t border-white/10">
        <p className="text-muted/60 text-sm mb-3">Have a session code from your captain?</p>
        <Link
          to="/session/join"
          className="inline-block px-4 py-2.5 border border-white/15 hover:border-white/30 text-muted hover:text-white text-sm rounded-lg transition-colors"
        >
          Join Session →
        </Link>
      </div>
    </div>
  )
}
