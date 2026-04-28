"""
Game tree optimizer — complete enumeration with maximin strategy.

Implements a complete decision tree for the 5v5 team pairing game:

  Round 1 (5v5):
    YOUR choices  (maximize score): defender, attacker pair, counter-pick
    OPP choices   (adversarial):    defender, attacker pair, counter-pick

  Round 2 (3v3 — remaining after Round 1):
    YOUR choices: defender, counter-pick (which opp attacker your def faces)
    OPP choices:  defender, counter-pick (which of your attackers their def faces)
    5th pairing is automatic (the two unchosen attackers)

Strategy: maximin — for YOUR nodes, maximize; for OPP nodes, assume worst case
(they minimize your score).

Memoisation: Round 2 depends only on which 3 players remain per side.
C(5,3) × C(5,3) = 100 unique states; each is computed once.

Total complete game-tree paths: 5×5×C(4,2)×C(4,2)×4×36 = 129,600.

Output matches the OptimizationResult TypeScript interface exactly
(see frontend/src/types/optimization.ts and GREENFIELD_ARCHITECTURE_v2.md §5.3).
"""

from __future__ import annotations

import hashlib
import json
import time
from itertools import combinations
from typing import Any, Dict


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _score(your: str, opp: str, predictions: Dict[str, Dict[str, float]]) -> float:
    return float(predictions.get(your, {}).get(opp, 0.0))


def _r2_key(your3: list[str], opp3: list[str]) -> str:
    """Canonical lookup key for a Round 2 state."""
    return f"{','.join(sorted(your3))}|{','.join(sorted(opp3))}"


# ---------------------------------------------------------------------------
# Round 2 tree builder
# ---------------------------------------------------------------------------

def _compute_r2_tree(
    your3: list[str],
    opp3: list[str],
    predictions: Dict[str, Dict[str, float]],
) -> Dict[str, Any]:
    """
    Build the Round 2 decision tree for 3 remaining players per side.

    AttackerOptions represent YOUR counter-pick choice: which of the 2 incoming
    opponent attackers your defender will face.  For each option (j), the
    adversarial variable is the opponent defender's counter-pick (which of your
    2 attackers they face, index i):

        worst_case[j] = min over i of total(j, i)   -- opp picks adversarially
        best_case[j]  = max over i of total(j, i)   -- opp picks helpfully

    The recommended option is the j that maximises worst_case (maximin).
    """
    def_options: list[dict] = []

    for your_def in your3:
        your_atks = [p for p in your3 if p != your_def]   # exactly 2
        opp_responses: dict[str, list[dict]] = {}
        def_worst = float("inf")
        def_best = float("-inf")

        for opp_def in opp3:
            opp_atks = [p for p in opp3 if p != opp_def]  # exactly 2

            attacker_opts: list[dict] = []
            for j in range(2):
                # YOUR counter-pick: your_def faces opp_atks[j]
                opp_atk_faced = opp_atks[j]
                opp_atk_auto  = opp_atks[1 - j]

                path_scores: list[float] = []
                for i in range(2):
                    # OPP counter-pick: opp_def faces your_atks[i]
                    your_atk_faced = your_atks[i]
                    your_atk_auto  = your_atks[1 - i]
                    total = (
                        _score(your_def,     opp_atk_faced, predictions)  # pairing 3
                        + _score(your_atk_faced, opp_def,       predictions)  # pairing 4
                        + _score(your_atk_auto,  opp_atk_auto,  predictions)  # pairing 5 (auto)
                    )
                    path_scores.append(total)

                attacker_opts.append({
                    "attackers": list(your_atks),          # both non-defs are sent
                    "is_recommended": False,
                    "worst_case_total": round(min(path_scores), 1),
                    "best_case_total":  round(max(path_scores), 1),
                })

            # You pick j to maximise worst-case (maximin)
            attacker_opts.sort(key=lambda x: x["worst_case_total"], reverse=True)
            attacker_opts[0]["is_recommended"] = True

            best_atk = attacker_opts[0]
            # Opp reveals their defender adversarially → take min/max over opp_def
            def_worst = min(def_worst, best_atk["worst_case_total"])
            def_best  = max(def_best,  best_atk["best_case_total"])
            opp_responses[opp_def] = attacker_opts

        def_options.append({
            "player": your_def,
            "is_recommended": False,
            "worst_case_total": round(def_worst, 1),
            "best_case_total":  round(def_best, 1),
            "opponent_responses": opp_responses,
        })

    # You pick defender to maximise worst-case
    def_options.sort(key=lambda x: x["worst_case_total"], reverse=True)
    def_options[0]["is_recommended"] = True
    return {"defender_options": def_options}


# ---------------------------------------------------------------------------
# Round 1 tree builder (with R2 lookahead)
# ---------------------------------------------------------------------------

def _compute_r1_tree(
    your_players: list[str],
    opponent_players: list[str],
    predictions: Dict[str, Dict[str, float]],
    round_2_lookup: Dict[str, Dict[str, Any]],
) -> list[dict]:
    """
    Build Round 1 defender options with full R2 lookahead.

    For each (your_def, opp_def) pair:
      - Iterate over C(4,2)=6 YOUR attacker pairs (your choice, maximise).
      - For each, iterate over C(4,2)=6 OPP attacker pairs (adversarial, minimise).
      - For each attacker exchange, evaluate all 4 counter-pick outcomes
        (j = your_def's choice of which opp_atk to face,
         i = opp_def's choice of which your_atk to face).
      - Compute R1 score + best R2 score from the resulting 3v3 state.

    Decision nesting (worst case):
        max_j [ min_i ( r1_score(j,i) + r2_worst(remaining(j,i)) ) ]

    Then, over opp attacker pair choices:
        attacker_option[your_atks].worst = min over opp_atks of max_j[min_i[...]]
        attacker_option[your_atks].best  = max over opp_atks of max_j[max_i[...]]

    Defender-level worst/best aggregates over opp_def (adversarial → min for worst).
    """
    r1_options: list[dict] = []

    for your_def in your_players:
        your_rem4 = [p for p in your_players if p != your_def]
        opp_responses: dict[str, list[dict]] = {}
        def_worst = float("inf")
        def_best  = float("-inf")

        for opp_def in opponent_players:
            opp_rem4 = [p for p in opponent_players if p != opp_def]
            atk_options: list[dict] = []

            for your_atks_tuple in combinations(your_rem4, 2):
                your_atks  = list(your_atks_tuple)
                your_kept2 = [p for p in your_rem4 if p not in your_atks]

                # Opp picks their attacker pair adversarially
                worst_over_opp = float("inf")
                best_over_opp  = float("-inf")

                for opp_atks_tuple in combinations(opp_rem4, 2):
                    opp_atks  = list(opp_atks_tuple)
                    opp_kept2 = [p for p in opp_rem4 if p not in opp_atks]

                    # For each of YOUR counter-pick choices (j):
                    per_j_worst: list[float] = []
                    per_j_best:  list[float] = []

                    for j in range(2):
                        # YOUR CHOICE: your_def faces opp_atks[j]
                        opp_atk_selected = opp_atks[j]
                        opp_atk_returned = opp_atks[1 - j]

                        per_i_wc: list[float] = []
                        per_i_bc: list[float] = []

                        for i in range(2):
                            # OPP CHOICE: opp_def faces your_atks[i]
                            your_atk_selected = your_atks[i]
                            your_atk_returned = your_atks[1 - i]

                            r1_score = (
                                _score(your_def,          opp_atk_selected, predictions)
                                + _score(your_atk_selected, opp_def,          predictions)
                            )

                            # Remaining 3 per side for Round 2
                            your_r3 = sorted(your_kept2 + [your_atk_returned])
                            opp_r3  = sorted(opp_kept2  + [opp_atk_returned])
                            r2_tree = round_2_lookup[_r2_key(your_r3, opp_r3)]

                            # You play optimally in R2 → pick the best defender option
                            r2_wc = max(
                                opt["worst_case_total"]
                                for opt in r2_tree["defender_options"]
                            )
                            r2_bc = max(
                                opt["best_case_total"]
                                for opt in r2_tree["defender_options"]
                            )

                            per_i_wc.append(r1_score + r2_wc)
                            per_i_bc.append(r1_score + r2_bc)

                        # Opp minimises over i → min; your bc: opp maximises → max
                        per_j_worst.append(min(per_i_wc))
                        per_j_best.append(max(per_i_bc))

                    # You maximise over j
                    worst_given_opp = max(per_j_worst)
                    best_given_opp  = max(per_j_best)

                    # Opp picks their attacker pair adversarially
                    worst_over_opp = min(worst_over_opp, worst_given_opp)
                    best_over_opp  = max(best_over_opp,  best_given_opp)

                atk_options.append({
                    "attackers": your_atks,
                    "is_recommended": False,
                    "worst_case_total": round(worst_over_opp, 1),
                    "best_case_total":  round(best_over_opp, 1),
                })

            # Recommend attacker pair with highest worst-case (maximin)
            atk_options.sort(key=lambda x: x["worst_case_total"], reverse=True)
            atk_options[0]["is_recommended"] = True

            best_atk = atk_options[0]
            # Opp reveals their defender adversarially
            def_worst = min(def_worst, best_atk["worst_case_total"])
            def_best  = max(def_best,  best_atk["best_case_total"])
            opp_responses[opp_def] = atk_options

        r1_options.append({
            "player": your_def,
            "is_recommended": False,
            "worst_case_total": round(def_worst, 1),
            "best_case_total":  round(def_best, 1),
            "opponent_responses": opp_responses,
        })

    # Recommend defender with highest worst-case
    r1_options.sort(key=lambda x: x["worst_case_total"], reverse=True)
    r1_options[0]["is_recommended"] = True
    return r1_options


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def optimize(
    your_players: list[str],
    opponent_players: list[str],
    predictions: Dict[str, Dict[str, float]],
) -> Dict[str, Any]:
    """
    Build a complete maximin decision tree for a 5v5 team pairing round.

    Parameters
    ----------
    your_players:
        List of exactly 5 player names from your team.
    opponent_players:
        List of exactly 5 opponent player names.
    predictions:
        5×5 prediction matrix — predictions[your_player][opp_player] = float score.
        Each score is 0–20 (integers or half-points).

    Returns
    -------
    dict matching the OptimizationResult TypeScript interface:
    {
        "round_1": {
            "defender_options": [...]   # 5 options, sorted by worst_case_total desc
        },
        "round_2_lookup": {
            "Alice,Bob,Carol|E2,E3,E4": {"defender_options": [...]}
            ...                          # 100 entries, one per C(5,3)×C(5,3) state
        },
        "metadata": {
            "total_scenarios": 129600,
            "computation_time_ms": int,
            "prediction_hash": str,
        }
    }
    """
    if len(your_players) != 5 or len(opponent_players) != 5:
        raise ValueError("Both sides must have exactly 5 players.")

    t_start = time.time()

    # ── Step 1: Pre-compute all 100 Round 2 states (memoised) ────────────────
    round_2_lookup: Dict[str, Dict[str, Any]] = {}
    for your3 in combinations(your_players, 3):
        for opp3 in combinations(opponent_players, 3):
            key = _r2_key(list(your3), list(opp3))
            round_2_lookup[key] = _compute_r2_tree(list(your3), list(opp3), predictions)

    # ── Step 2: Build Round 1 tree with R2 lookahead ─────────────────────────
    r1_options = _compute_r1_tree(
        your_players, opponent_players, predictions, round_2_lookup
    )

    elapsed_ms = int((time.time() - t_start) * 1000)
    pred_hash = hashlib.md5(
        json.dumps(predictions, sort_keys=True).encode()
    ).hexdigest()[:8]

    # Total complete game-tree paths (deterministic for 5v5):
    #   5 your_def × 5 opp_def × C(4,2) your_atks × C(4,2) opp_atks
    #   × 4 R1 counter-picks × 36 R2 paths = 129,600
    total_scenarios = 5 * 5 * 6 * 6 * 4 * 36  # 129,600

    return {
        "round_1": {"defender_options": r1_options},
        "round_2_lookup": round_2_lookup,
        "metadata": {
            "total_scenarios": total_scenarios,
            "computation_time_ms": elapsed_ms,
            "prediction_hash": pred_hash,
        },
    }
