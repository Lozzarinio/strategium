/**
 * Complete optimization result returned by POST /api/v1/rounds/{id}/optimize.
 *
 * The frontend stores this in React state + localStorage and navigates
 * the tree locally during the wizard. No server calls during wizard steps.
 */
export interface OptimizationResult {
  round_1: Round1Tree;
  round_2_lookup: Record<string, Round2Tree>;
  metadata: OptimizationMetadata;
}

/**
 * Round 1 decision tree.
 * Captain picks a defender → opponent reveals their defender → captain picks attackers.
 */
export interface Round1Tree {
  defender_options: DefenderOption[];
}

/**
 * Round 2 decision tree, keyed by remaining players.
 *
 * Key format: "Alice,Bob,Carol|Enemy2,Enemy3,Enemy4"
 * (sorted alphabetically on each side, separated by pipe)
 *
 * The frontend constructs this key from whoever wasn't paired in Round 1,
 * then looks up Round 2 recommendations.
 */
export interface Round2Tree {
  defender_options: DefenderOption[];
}

/**
 * A possible defender choice for the captain.
 */
export interface DefenderOption {
  /** Player name */
  player: string;
  /** Whether the optimizer recommends this choice */
  is_recommended: boolean;
  /** Guaranteed minimum total score if captain picks this defender (maximin) */
  worst_case_total: number;
  /** Best achievable total score if captain picks this defender */
  best_case_total: number;
  /**
   * For each possible opponent defender, the available attacker options.
   * Keyed by opponent player name.
   */
  opponent_responses: Record<string, AttackerOption[]>;
}

/**
 * A possible attacker pair choice for the captain.
 * Available after both defenders are known.
 */
export interface AttackerOption {
  /** The two players to send as attackers */
  attackers: [string, string];
  /** Whether the optimizer recommends this pair */
  is_recommended: boolean;
  /** Guaranteed minimum total score with this attacker pair */
  worst_case_total: number;
  /** Best achievable total score with this attacker pair */
  best_case_total: number;
}

/**
 * Metadata about the optimization computation.
 */
export interface OptimizationMetadata {
  /** Total game tree scenarios evaluated */
  total_scenarios: number;
  /** How long the computation took in milliseconds */
  computation_time_ms: number;
  /** Hash of the prediction matrix used (for cache validation) */
  prediction_hash: string;
}

/**
 * A single pairing result recorded during the wizard.
 */
export interface PairingRecord {
  your_player: string;
  opponent_player: string;
  predicted_score: number;
}

/**
 * Submitted to POST /api/v1/rounds/{id}/completed-pairings
 * after the wizard is complete.
 */
export interface CompletedPairingsPayload {
  pairings: PairingRecord[];  // Exactly 5
  total_predicted_score: number;
  optimization_best_score: number;
}
