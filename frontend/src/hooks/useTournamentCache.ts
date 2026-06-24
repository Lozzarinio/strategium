import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../api/client'
import type { TournamentOut } from '../api/client'

const CACHE_PREFIX = 'strategium-tournament-'
const STALE_MS = 5 * 60 * 1000 // 5 minutes

interface CacheEntry {
  data: TournamentOut
  timestamp: number
}

function cacheKey(id: number | string): string {
  return `${CACHE_PREFIX}${id}`
}

function readCache(id: number | string): CacheEntry | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(id))
    return raw ? (JSON.parse(raw) as CacheEntry) : null
  } catch {
    return null
  }
}

/** Seeds/overwrites the cache directly — used right after create/captain-auth, which already return the full tournament. */
export function writeTournamentCache(id: number | string, data: TournamentOut): void {
  try {
    sessionStorage.setItem(cacheKey(id), JSON.stringify({ data, timestamp: Date.now() }))
  } catch {
    /* ignore storage errors (quota, private mode) */
  }
}

function isFresh(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp < STALE_MS
}

/**
 * Loads + caches tournament data (dashboard, round detail, wizard) in sessionStorage.
 *
 * Cached data is shown immediately — even if stale — so navigation between captain
 * pages feels instant. `loading` is only true on a genuine cache miss; stale-cache
 * revalidation and refreshCache() both update `tournament` silently in the background.
 */
export function useTournamentCache(id: string | undefined) {
  const [tournament, setTournament] = useState<TournamentOut | null>(() =>
    id ? readCache(id)?.data ?? null : null
  )
  const [loading, setLoading] = useState(() => !(id && readCache(id)))
  const [error, setError] = useState<string | null>(null)
  const idRef = useRef(id)
  idRef.current = id

  const fetchFresh = useCallback(async () => {
    const currentId = idRef.current
    if (!currentId) return
    try {
      const fresh = await api.getTournament(currentId)
      writeTournamentCache(currentId, fresh)
      setTournament(fresh)
      setError(null)
    } catch {
      // Silent — background revalidation failures keep showing whatever we already have.
    }
  }, [])

  useEffect(() => {
    if (!id) return
    const cached = readCache(id)

    if (cached) {
      setTournament(cached.data)
      setLoading(false)
      if (!isFresh(cached)) void fetchFresh()
      return
    }

    setLoading(true)
    setError(null)
    api.getTournament(id)
      .then(fresh => {
        writeTournamentCache(id, fresh)
        setTournament(fresh)
      })
      .catch(err => {
        setError(err instanceof ApiError ? err.message : 'Failed to load tournament.')
      })
      .finally(() => setLoading(false))
  }, [id, fetchFresh])

  return { tournament, loading, error, refreshCache: fetchFresh, setTournament }
}
