const STORAGE_KEY = 'strategium-my-tournaments'

export function getMyTournamentIds(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as number[]) : []
  } catch {
    return []
  }
}

export function addMyTournamentId(id: number): void {
  const ids = getMyTournamentIds()
  if (!ids.includes(id)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids, id]))
  }
}

export function removeMyTournamentIds(toRemove: number[]): void {
  if (toRemove.length === 0) return
  const remaining = getMyTournamentIds().filter(id => !toRemove.includes(id))
  localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining))
}

export function useIsOwner(tournamentId: number | string | undefined): boolean {
  if (tournamentId === undefined) return false
  return getMyTournamentIds().includes(Number(tournamentId))
}
