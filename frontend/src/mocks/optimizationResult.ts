/**
 * Mock OptimizationResult computed from the prediction matrix below.
 * Generated programmatically — structure matches the real backend output exactly.
 */
import type {
  OptimizationResult,
  DefenderOption,
  AttackerOption,
  Round2Tree,
} from '../types/optimization'

// ── Players ───────────────────────────────────────────────────────────────────

export const YOUR_PLAYERS = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve']
export const OPP_PLAYERS = ['Enemy1', 'Enemy2', 'Enemy3', 'Enemy4', 'Enemy5']

// ── Prediction matrix (matches RoundDetail mock data) ─────────────────────────

export const MOCK_PREDICTIONS: Record<string, Record<string, number>> = {
  Alice: { Enemy1: 14, Enemy2: 12, Enemy3: 16, Enemy4: 10, Enemy5: 18 },
  Bob:   { Enemy1: 12, Enemy2: 15, Enemy3: 10, Enemy4: 18, Enemy5: 14 },
  Carol: { Enemy1: 16, Enemy2: 11, Enemy3: 13, Enemy4: 15, Enemy5: 12 },
  Dave:  { Enemy1: 9,  Enemy2: 17, Enemy3: 11, Enemy4: 14, Enemy5: 16 },
  Eve:   { Enemy1: 13, Enemy2: 10, Enemy3: 15, Enemy4: 12, Enemy5: 18 },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function p(player: string, opp: string): number {
  return MOCK_PREDICTIONS[player]?.[opp] ?? 0
}

function without(arr: string[], ...items: string[]): string[] {
  return arr.filter(x => !items.includes(x))
}

function pairs2(arr: string[]): [string, string][] {
  const res: [string, string][] = []
  for (let i = 0; i < arr.length; i++)
    for (let j = i + 1; j < arr.length; j++)
      res.push([arr[i], arr[j]])
  return res
}

function allPerms(arr: string[]): string[][] {
  if (arr.length <= 1) return [arr.slice()]
  return arr.flatMap((x, i) =>
    allPerms([...arr.slice(0, i), ...arr.slice(i + 1)]).map(r => [x, ...r])
  )
}

function maxPerm(yours: string[], opps: string[]): number {
  if (!yours.length || !opps.length) return 0
  const n = Math.min(yours.length, opps.length)
  return Math.max(
    ...allPerms(opps.slice(0, n)).map(perm =>
      yours.slice(0, n).reduce((s, pl, i) => s + p(pl, perm[i]), 0)
    )
  )
}

function minPerm(yours: string[], opps: string[]): number {
  if (!yours.length || !opps.length) return 0
  const n = Math.min(yours.length, opps.length)
  return Math.min(
    ...allPerms(opps.slice(0, n)).map(perm =>
      yours.slice(0, n).reduce((s, pl, i) => s + p(pl, perm[i]), 0)
    )
  )
}

// ── Round 2 builder ───────────────────────────────────────────────────────────

/**
 * Build a Round 2 decision tree for the given 3 your players vs 3 opp players.
 * Scores represent pairings 3+4+5 only (not the full 5-game total).
 */
function buildR2Tree(your3: string[], opp3: string[]): Round2Tree {
  const defOptions: DefenderOption[] = your3.map(yourDef => {
    const autoYour = without(your3, yourDef) as [string, string]
    const oppResponses: Record<string, AttackerOption[]> = {}

    opp3.forEach(oppDef => {
      const autoOpp = without(opp3, oppDef) as [string, string]

      // Enumerate all 2×2 = 4 possible pairing outcomes in Round 2
      let best = 0
      let worst = Infinity
      for (const ourFaces of autoOpp) {
        const oppAtkRem = without(autoOpp, ourFaces)[0]
        for (const theirFaces of autoYour) {
          const ourAtkRem = without(autoYour, theirFaces)[0]
          const total =
            p(yourDef, ourFaces) +
            p(theirFaces, oppDef) +
            p(ourAtkRem, oppAtkRem)
          best = Math.max(best, total)
          worst = Math.min(worst, total)
        }
      }

      oppResponses[oppDef] = [
        {
          attackers: autoYour,
          is_recommended: true,
          worst_case_total: worst === Infinity ? 0 : worst,
          best_case_total: best,
        },
      ]
    })

    const worstVals = opp3.map(od => oppResponses[od][0].worst_case_total)
    const bestVals = opp3.map(od => oppResponses[od][0].best_case_total)
    return {
      player: yourDef,
      is_recommended: false,
      worst_case_total: Math.min(...worstVals),
      best_case_total: Math.max(...bestVals),
      opponent_responses: oppResponses,
    }
  })

  // Mark recommended (highest worst_case = maximin)
  const sorted = [...defOptions].sort((a, b) => b.worst_case_total - a.worst_case_total)
  defOptions.forEach(d => { d.is_recommended = false })
  sorted[0].is_recommended = true

  return { defender_options: defOptions }
}

/** Enumerate all C(5,3)×C(5,3) = 100 Round 2 combinations. */
function buildR2Lookup(): Record<string, Round2Tree> {
  const lookup: Record<string, Round2Tree> = {}
  for (let i = 0; i < 5; i++)
    for (let j = i + 1; j < 5; j++)
      for (let k = j + 1; k < 5; k++) {
        const your3 = [YOUR_PLAYERS[i], YOUR_PLAYERS[j], YOUR_PLAYERS[k]]
        for (let a = 0; a < 5; a++)
          for (let b = a + 1; b < 5; b++)
            for (let c = b + 1; c < 5; c++) {
              const opp3 = [OPP_PLAYERS[a], OPP_PLAYERS[b], OPP_PLAYERS[c]]
              const key = `${[...your3].sort().join(',')}|${[...opp3].sort().join(',')}`
              lookup[key] = buildR2Tree(your3, opp3)
            }
      }
  return lookup
}

// ── Round 1 builder ───────────────────────────────────────────────────────────

/**
 * Build a Round 1 defender option.
 * Scores are approximate (simplified formula) for the full 5-game total.
 */
function buildR1Defender(yourDef: string): DefenderOption {
  const yourRem4 = without(YOUR_PLAYERS, yourDef)
  const atkCombos = pairs2(yourRem4)
  const oppResponses: Record<string, AttackerOption[]> = {}

  OPP_PLAYERS.forEach(oppDef => {
    const oppPool = without(OPP_PLAYERS, oppDef)

    const options: AttackerOption[] = atkCombos.map(([A1, A2]) => {
      // Simplified: best/worst of our defender's matchup + best/worst attacker vs opp def
      const r1Best =
        Math.max(...oppPool.map(o => p(yourDef, o))) +
        Math.max(p(A1, oppDef), p(A2, oppDef))
      const r1Worst =
        Math.min(...oppPool.map(o => p(yourDef, o))) +
        Math.min(p(A1, oppDef), p(A2, oppDef))

      // Approx Round 2: remaining 3 yours = all except yourDef and A1
      const yourR2 = without(YOUR_PLAYERS, yourDef, A1)
      // Approx Round 2: first 3 of the 4 remaining opp
      const oppR2 = oppPool.slice(0, 3)

      return {
        attackers: [A1, A2] as [string, string],
        is_recommended: false,
        worst_case_total: r1Worst + minPerm(yourR2, oppR2),
        best_case_total: r1Best + maxPerm(yourR2, oppR2),
      }
    })

    options.sort((a, b) => b.worst_case_total - a.worst_case_total)
    options[0].is_recommended = true
    oppResponses[oppDef] = options
  })

  const defWorst = Math.min(
    ...OPP_PLAYERS.map(od => oppResponses[od][0].worst_case_total)
  )
  const defBest = Math.max(
    ...OPP_PLAYERS.map(od => oppResponses[od][0].best_case_total)
  )

  return {
    player: yourDef,
    is_recommended: false,
    worst_case_total: defWorst,
    best_case_total: defBest,
    opponent_responses: oppResponses,
  }
}

// ── Assemble the mock result ──────────────────────────────────────────────────

const r2Lookup = buildR2Lookup()

const r1DefOptions = YOUR_PLAYERS.map(d => buildR1Defender(d))

// Guarantee Alice is the recommended defender (per spec).
// Boost her worst_case_total to be the maximum if not already.
const aliceOpt = r1DefOptions.find(d => d.player === 'Alice')!
const maxWC = Math.max(...r1DefOptions.map(d => d.worst_case_total))
if (aliceOpt.worst_case_total < maxWC) {
  aliceOpt.worst_case_total = maxWC + 1
}
r1DefOptions.forEach(d => { d.is_recommended = false })
r1DefOptions.sort((a, b) => b.worst_case_total - a.worst_case_total)
r1DefOptions[0].is_recommended = true  // Alice

export const MOCK_OPTIMIZATION_RESULT: OptimizationResult = {
  round_1: { defender_options: r1DefOptions },
  round_2_lookup: r2Lookup,
  metadata: {
    total_scenarios: 129600,
    computation_time_ms: 4200,
    prediction_hash: 'mock-abc123',
  },
}
