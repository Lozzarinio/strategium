import { useState, useEffect, useCallback } from 'react'
import type {
  OptimizationResult,
  DefenderOption,
  AttackerOption,
  PairingRecord,
} from '../types/optimization'

// ── State shape ───────────────────────────────────────────────────────────────

export interface WizardState {
  currentStep: number  // 1–8

  // Round 1 selections
  r1Defender: string | null
  r1OppDefender: string | null
  r1Attackers: [string, string] | null  // 2 attacker candidates

  // Round 1 pairings (recorded in step 4)
  // Pairing 1: r1Defender vs some opp attacker
  // Pairing 2: one of r1Attackers vs r1OppDefender
  r1Pairings: PairingRecord[]

  // Round 2 selections
  r2Defender: string | null
  r2OppDefender: string | null

  // Round 2 pairings (recorded in step 7)
  // Pairing 3: r2Defender vs some opp R2 attacker
  // Pairing 4: one of your R2 attackers vs r2OppDefender
  r2Pairings: PairingRecord[]

  // 5th pairing — automatically determined from remaining players
  finalPairing: PairingRecord | null
}

const INITIAL_STATE: WizardState = {
  currentStep: 1,
  r1Defender: null,
  r1OppDefender: null,
  r1Attackers: null,
  r1Pairings: [],
  r2Defender: null,
  r2OppDefender: null,
  r2Pairings: [],
  finalPairing: null,
}

// ── Lookup key ────────────────────────────────────────────────────────────────

function sortedKey(a: string[], b: string[]): string {
  return `${[...a].sort().join(',')}|${[...b].sort().join(',')}`
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useWizardState(
  optimizationResult: OptimizationResult,
  allYourPlayers: string[],
  allOppPlayers: string[],
  predictions: Record<string, Record<string, number>>,
  roundId: string,
) {
  const storageKey = `strategium-wizard-${roundId}`

  function loadFromStorage(): WizardState {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) return { ...INITIAL_STATE, ...JSON.parse(raw) }
    } catch { /* ignore */ }
    return INITIAL_STATE
  }

  const [state, setStateRaw] = useState<WizardState>(loadFromStorage)

  function setState(updater: WizardState | ((prev: WizardState) => WizardState)) {
    setStateRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  useEffect(() => {
    setStateRaw(loadFromStorage())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId])

  // ── Derived: R2 player pools ─────────────────────────────────────────────

  // After step 4 records r1Pairings, we know exactly which players were used in R1.
  const r1UsedYour = state.r1Pairings.map(p => p.your_player)
  const r1UsedOpp  = state.r1Pairings.map(p => p.opponent_player)

  // If pairings aren't yet recorded, fall back to the selections for partial UI.
  const r2YourPlayers = state.r1Pairings.length === 2
    ? allYourPlayers.filter(p => !r1UsedYour.includes(p))          // 3 players
    : allYourPlayers.filter(p => p !== state.r1Defender &&
        !(state.r1Attackers?.includes(p)))                           // approximate

  const r2OppPlayers = state.r1Pairings.length === 2
    ? allOppPlayers.filter(p => !r1UsedOpp.includes(p))             // 3 players
    : allOppPlayers.filter(p => p !== state.r1OppDefender)          // approximate (4)

  const round2LookupKey = r2YourPlayers.length === 3 && r2OppPlayers.length === 3
    ? sortedKey(r2YourPlayers, r2OppPlayers)
    : null

  const round2Tree = round2LookupKey
    ? (optimizationResult.round_2_lookup[round2LookupKey] ?? null)
    : null

  // ── Derived: pairings & running total ────────────────────────────────────

  const allRecordedPairings: PairingRecord[] = [
    ...state.r1Pairings,
    ...state.r2Pairings,
    ...(state.finalPairing ? [state.finalPairing] : []),
  ]

  const runningTotal = allRecordedPairings.reduce((s, p) => s + p.predicted_score, 0)

  // ── Recommendation getters ───────────────────────────────────────────────

  function getR1DefenderOptions(): DefenderOption[] {
    return optimizationResult.round_1.defender_options
  }

  function getR1AttackerOptions(): AttackerOption[] {
    if (!state.r1Defender || !state.r1OppDefender) return []
    const defOpt = optimizationResult.round_1.defender_options.find(
      d => d.player === state.r1Defender
    )
    return defOpt?.opponent_responses[state.r1OppDefender] ?? []
  }

  function getR2DefenderOptions(): DefenderOption[] {
    return round2Tree?.defender_options ?? []
  }

  function getR2AttackerOptions(): AttackerOption[] {
    if (!state.r2Defender || !state.r2OppDefender || !round2Tree) return []
    const defOpt = round2Tree.defender_options.find(d => d.player === state.r2Defender)
    return defOpt?.opponent_responses[state.r2OppDefender] ?? []
  }

  // ── Predicted score helper ───────────────────────────────────────────────

  function predictedScore(yourPlayer: string, oppPlayer: string): number {
    return predictions[yourPlayer]?.[oppPlayer] ?? 0
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  const setR1Defender = useCallback((player: string) => {
    setState(prev => ({ ...prev, r1Defender: player }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const confirmR1Defender = useCallback(() => {
    setState(prev => ({ ...prev, currentStep: 2 }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setR1OppDefender = useCallback((player: string) => {
    setState(prev => ({ ...prev, r1OppDefender: player, currentStep: 3 }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setR1Attackers = useCallback((attackers: [string, string]) => {
    setState(prev => ({ ...prev, r1Attackers: attackers, currentStep: 4 }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setR1Pairings = useCallback((pairings: PairingRecord[]) => {
    setState(prev => ({ ...prev, r1Pairings: pairings, currentStep: 5 }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setR2Defender = useCallback((player: string) => {
    setState(prev => ({ ...prev, r2Defender: player }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const confirmR2Defender = useCallback(() => {
    setState(prev => ({ ...prev, currentStep: 6 }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setR2OppDefender = useCallback((player: string) => {
    setState(prev => ({ ...prev, r2OppDefender: player, currentStep: 7 }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setR2Pairings = useCallback((pairings: PairingRecord[]) => {
    // Compute automatic 5th pairing from remaining R2 players
    const r2UsedYour = pairings.map(p => p.your_player)
    const r2UsedOpp  = pairings.map(p => p.opponent_player)
    // r2YourPlayers is captured from closure — use state.r1Pairings to re-derive
    setState(prev => {
      const myUsedR1 = prev.r1Pairings.map(p => p.your_player)
      const oppUsedR1 = prev.r1Pairings.map(p => p.opponent_player)
      const myR2Pool  = allYourPlayers.filter(p => !myUsedR1.includes(p))
      const oppR2Pool = allOppPlayers.filter(p => !oppUsedR1.includes(p))

      const finalYour = myR2Pool.find(p => !r2UsedYour.includes(p)) ?? ''
      const finalOpp  = oppR2Pool.find(p => !r2UsedOpp.includes(p)) ?? ''

      const finalPairing: PairingRecord = {
        your_player: finalYour,
        opponent_player: finalOpp,
        predicted_score: predictions[finalYour]?.[finalOpp] ?? 0,
      }

      return { ...prev, r2Pairings: pairings, finalPairing, currentStep: 8 }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allYourPlayers, allOppPlayers, predictions])

  const goToStep = useCallback((step: number) => {
    setState(prev => ({ ...prev, currentStep: step }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resetWizard = useCallback(() => {
    setState(INITIAL_STATE)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    state,
    // Computed
    r2YourPlayers,
    r2OppPlayers,
    round2Tree,
    runningTotal,
    allRecordedPairings,
    // Helpers
    predictedScore,
    // Recommendation getters
    getR1DefenderOptions,
    getR1AttackerOptions,
    getR2DefenderOptions,
    getR2AttackerOptions,
    // Actions
    setR1Defender,
    confirmR1Defender,
    setR1OppDefender,
    setR1Attackers,
    setR1Pairings,
    setR2Defender,
    confirmR2Defender,
    setR2OppDefender,
    setR2Pairings,
    goToStep,
    resetWizard,
  }
}

export type WizardHook = ReturnType<typeof useWizardState>
