import type { OptimizationResult, CompletedPairingsPayload } from '../types/optimization'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

// ── Error type ────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// ── Wake-up state tracking ────────────────────────────────────────────────────
// Notifies subscribers when any request takes >3 seconds without a response,
// indicating the Render backend may be cold-starting.

type WakeUpListener = (waking: boolean) => void
const wakeUpListeners = new Set<WakeUpListener>()
let slowRequestCount = 0

export function onWakeUpChange(fn: WakeUpListener): () => void {
  wakeUpListeners.add(fn)
  return () => wakeUpListeners.delete(fn)
}

function notifyWakeUp(delta: 1 | -1) {
  slowRequestCount = Math.max(0, slowRequestCount + delta)
  const waking = slowRequestCount > 0
  for (const fn of wakeUpListeners) fn(waking)
}

// ── Core request helper ───────────────────────────────────────────────────────

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let isSlowRequest = false
  let timedOut = false
  const controller = new AbortController()

  const wakeTimer = setTimeout(() => {
    isSlowRequest = true
    notifyWakeUp(1)
  }, 3000)

  const timeoutTimer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, 45_000)

  const finish = () => {
    clearTimeout(wakeTimer)
    clearTimeout(timeoutTimer)
    if (isSlowRequest) notifyWakeUp(-1)
  }

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
      signal: controller.signal,
    })
    finish()

    if (!res.ok) {
      let detail = res.statusText
      try {
        const body = await res.json()
        detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body)
      } catch { /* ignore */ }
      throw new ApiError(res.status, detail)
    }
    if (res.status === 204) return undefined as T
    return res.json()
  } catch (err) {
    finish()
    if (err instanceof ApiError) throw err
    if (timedOut) {
      throw new ApiError(0, 'The server is taking longer than expected. Please refresh the page.')
    }
    throw new ApiError(0, 'Unable to reach the server. Please try again in a moment.')
  }
}

// ── Response types (matching backend schemas) ─────────────────────────────────

export interface PlayerOut {
  id: number
  name: string
  faction: string | null
  email: string | null
}

export interface TeamOut {
  id: number
  name: string
  players: PlayerOut[]
}

export interface OpponentPlayerOut {
  id: number
  name: string
  faction: string | null
  notes: string | null
}

export interface OpponentTeamOut {
  id: number
  name: string
  players: OpponentPlayerOut[]
}

export interface RoundOut {
  id: number
  round_number: number
  opponent_team_id: number | null
  predictions: Record<string, Record<string, number>>
}

export interface RoundDetailOut extends RoundOut {
  opponent_team: OpponentTeamOut | null
}

export interface SessionOut {
  id: number
  code: string
  rounds: RoundOut[]
}

export interface TournamentOut {
  id: number
  name: string
  team: TeamOut
  session: SessionOut
  opponent_teams: OpponentTeamOut[]
}

export interface TournamentListItem {
  id: number
  name: string
  created_at: string
}

export interface SessionDetailOut {
  id: number
  code: string
  tournament_id: number
  tournament_name: string
  team: TeamOut
  rounds: RoundDetailOut[]
}

export interface PredictionsOut {
  predictions: Record<string, Record<string, number>>
  complete: boolean
  missing_players: string[]
}

export interface CompletedPairingsOut {
  id: number
  round_id: number
  pairings: Array<{ your_player: string; opponent_player: string; predicted_score: number }>
  total_predicted_score: number
  optimization_best_score: number | null
  completed_at: string
}

// ── Optimizer response transform ──────────────────────────────────────────────
// The backend returns attackers as a list, but normalise defensively in case it
// arrives as a space-separated string in future schema versions.

function normaliseOptimizationResult(raw: unknown): OptimizationResult {
  const result = raw as OptimizationResult
  const fixAttackers = (ao: { attackers: [string, string] | string }) => {
    if (!Array.isArray(ao.attackers)) {
      ao.attackers = (ao.attackers as unknown as string).split(' ') as [string, string]
    }
    return ao
  }

  for (const defOpt of result.round_1.defender_options) {
    for (const atks of Object.values(defOpt.opponent_responses)) {
      atks.forEach(fixAttackers)
    }
  }
  for (const r2Tree of Object.values(result.round_2_lookup)) {
    for (const defOpt of r2Tree.defender_options) {
      for (const atks of Object.values(defOpt.opponent_responses)) {
        atks.forEach(fixAttackers)
      }
    }
  }
  return result
}

// ── API methods ───────────────────────────────────────────────────────────────

export const api = {
  // Tournaments

  createTournament: (data: {
    name: string
    num_rounds: number
    team: { name: string; players: Array<{ name: string; faction?: string; email?: string }> }
  }): Promise<TournamentOut> =>
    request('/tournaments', { method: 'POST', body: JSON.stringify(data) }),

  getTournaments: (): Promise<TournamentListItem[]> =>
    request('/tournaments'),

  getTournament: (id: number | string): Promise<TournamentOut> =>
    request(`/tournaments/${id}`),

  deleteTournament: (id: number | string): Promise<void> =>
    request(`/tournaments/${id}`, { method: 'DELETE' }),

  // Sessions

  getSession: (code: string): Promise<SessionDetailOut> =>
    request(`/sessions/${code}`),

  submitPredictions: (
    code: string,
    playerName: string,
    roundNumber: number,
    predictions: Record<string, number>,
  ): Promise<unknown> =>
    request(`/sessions/${code}/predictions`, {
      method: 'POST',
      body: JSON.stringify({ player_name: playerName, round_number: roundNumber, predictions }),
    }),

  // Predictions

  getPredictions: (roundId: number | string): Promise<PredictionsOut> =>
    request(`/rounds/${roundId}/predictions`),

  // Opponent teams

  createOpponentTeam: (
    tournamentId: number | string,
    data: { name: string; players: Array<{ name: string; faction?: string; notes?: string }> },
  ): Promise<OpponentTeamOut> =>
    request(`/tournaments/${tournamentId}/opponent-teams`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getOpponentTeams: (tournamentId: number | string): Promise<OpponentTeamOut[]> =>
    request(`/tournaments/${tournamentId}/opponent-teams`),

  updateOpponentTeam: (
    teamId: number | string,
    data: { name?: string; players?: Array<{ name: string; faction?: string; notes?: string }> },
  ): Promise<OpponentTeamOut> =>
    request(`/opponent-teams/${teamId}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteOpponentTeam: (teamId: number | string): Promise<void> =>
    request(`/opponent-teams/${teamId}`, { method: 'DELETE' }),

  // Rounds

  getRound: (roundId: number | string): Promise<RoundDetailOut> =>
    request(`/rounds/${roundId}`),

  updateRound: (roundId: number | string, data: { opponent_team_id: number | null }): Promise<RoundOut> =>
    request(`/rounds/${roundId}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Optimizer

  runOptimizer: async (roundId: number | string): Promise<OptimizationResult> => {
    const raw = await request(`/rounds/${roundId}/optimize`, { method: 'POST' })
    return normaliseOptimizationResult(raw)
  },

  // Completed pairings

  saveCompletedPairings: (roundId: number | string, data: CompletedPairingsPayload): Promise<CompletedPairingsOut> =>
    request(`/rounds/${roundId}/completed-pairings`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getCompletedPairings: (roundId: number | string): Promise<CompletedPairingsOut> =>
    request(`/rounds/${roundId}/completed-pairings`),
}
