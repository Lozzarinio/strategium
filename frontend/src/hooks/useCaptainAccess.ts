const STORAGE_KEY = 'strategium-captain-access'

interface CaptainAccess {
  tournamentId: number
  sessionCode: string
}

export function getCaptainAccess(): CaptainAccess | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CaptainAccess) : null
  } catch {
    return null
  }
}

export function setCaptainAccess(tournamentId: number, sessionCode: string): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ tournamentId, sessionCode }))
}

export function clearCaptainAccess(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}

/** True when the current tab has already authenticated (code + PIN) for this tournament. */
export function useHasCaptainAccess(tournamentId: number | string | undefined): boolean {
  if (tournamentId === undefined) return false
  const access = getCaptainAccess()
  return access !== null && access.tournamentId === Number(tournamentId)
}
