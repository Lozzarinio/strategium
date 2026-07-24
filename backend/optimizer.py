"""
Game tree optimizer — recursive maximin solver for 5v5 and 8v8 team pairing.

Each round, both captains reveal a defender simultaneously, then (if more than
2 players remain per side) each captain picks an attacker pair to send, then
each defender counter-picks which incoming attacker they face. The two
attackers not selected by the opposing counter-pick carry forward into the
next subgame. This repeats until 2 players remain per side, at which point
both are forced attackers and the round is decided with no further choices.

Strategy: maximin. YOUR choices (defender, attacker pair, counter-pick)
maximize your total score; OPPONENT choices are adversarial and minimize it.

Memoisation: a subgame is fully determined by the *set* of players remaining
per side, regardless of how they got there, so `subgame_score` caches on
(sorted your-tuple, sorted opp-tuple).
"""

from __future__ import annotations

import hashlib
import json
import time
from itertools import combinations
from typing import Any, Dict, List, Tuple


def optimize(
    your_players: List[str],
    opp_players: List[str],
    predictions: Dict[str, Dict[str, float]],
) -> Dict[str, Any]:
    """
    Build a complete maximin decision tree for a team pairing game.

    Parameters
    ----------
    your_players, opp_players:
        Equal-length lists of player names (5 or 8 per side).
    predictions:
        predictions[your_player][opp_player] = predicted score for that pairing.

    Returns
    -------
    dict with "round_1", "subgame_lookup", and "metadata" keys.
    """
    n = len(your_players)
    if n != len(opp_players) or n not in (5, 8):
        raise ValueError("Both sides must have the same number of players (5 or 8)")

    start = time.time()
    cache: Dict[str, List[dict]] = {}
    scenario_count = [0]

    def subgame_score(
        yours_tuple: Tuple[str, ...], opps_tuple: Tuple[str, ...]
    ) -> Tuple[float, float]:
        """
        Returns (worst_case, best_case) for optimal play from this subgame
        onward, and populates `cache[key]` with the full defender_options tree.
        """
        key = ",".join(yours_tuple) + "|" + ",".join(opps_tuple)
        if key in cache:
            options = cache[key]
            best_wc = max(d["worst_case_total"] for d in options)
            best_bc = max(d["best_case_total"] for d in options)
            return (best_wc, best_bc)

        n_sub = len(yours_tuple)
        defender_options: List[dict] = []

        for your_def in yours_tuple:
            your_rem = [p for p in yours_tuple if p != your_def]
            opp_responses: Dict[str, list] = {}
            def_wc = float("inf")
            def_bc = float("-inf")

            for opp_def in opps_tuple:
                opp_rem = [p for p in opps_tuple if p != opp_def]

                if n_sub == 2:
                    # Forced: 1 attacker each side, no choices left.
                    score = (
                        predictions[your_def][opp_rem[0]]
                        + predictions[your_rem[0]][opp_def]
                    )
                    scenario_count[0] += 1
                    opp_responses[opp_def] = [{
                        "attackers": list(your_rem),
                        "is_recommended": True,
                        "worst_case_total": score,
                        "best_case_total": score,
                    }]
                    def_wc = min(def_wc, score)
                    def_bc = max(def_bc, score)

                else:
                    # N >= 3: choose attacker pairs (auto if N==3), then counter-picks.
                    if n_sub == 3:
                        your_att_pairs = [tuple(sorted(your_rem))]
                        opp_att_pairs = [tuple(sorted(opp_rem))]
                    else:
                        your_att_pairs = list(combinations(sorted(your_rem), 2))
                        opp_att_pairs = list(combinations(sorted(opp_rem), 2))

                    att_options_for_this_opp_def: List[dict] = []

                    for your_atts in your_att_pairs:
                        your_kept = [p for p in your_rem if p not in your_atts]

                        pair_wc = float("inf")  # worst across opponent's attacker-pair choice
                        pair_bc = float("-inf")

                        for opp_atts in opp_att_pairs:
                            opp_kept = [p for p in opp_rem if p not in opp_atts]

                            best_your_pick_wc = float("-inf")
                            best_your_pick_bc = float("-inf")

                            for your_pick in opp_atts:
                                # YOUR counter-pick: your_def faces your_pick (MAX)
                                opp_not_picked = [a for a in opp_atts if a != your_pick][0]

                                worst_opp_pick = float("inf")
                                best_opp_pick = float("-inf")

                                for opp_pick in your_atts:
                                    # OPP counter-pick: opp_def faces opp_pick (MIN)
                                    your_not_picked = [a for a in your_atts if a != opp_pick][0]

                                    round_score = (
                                        predictions[your_def][your_pick]
                                        + predictions[opp_pick][opp_def]
                                    )

                                    your_next = tuple(sorted(your_kept + [your_not_picked]))
                                    opp_next = tuple(sorted(opp_kept + [opp_not_picked]))

                                    if len(your_next) == 1:
                                        # Auto-pair the last remaining player on each side.
                                        auto = predictions[your_next[0]][opp_next[0]]
                                        future_wc = auto
                                        future_bc = auto
                                        scenario_count[0] += 1
                                    else:
                                        future_wc, future_bc = subgame_score(your_next, opp_next)

                                    total_wc = round_score + future_wc
                                    total_bc = round_score + future_bc

                                    worst_opp_pick = min(worst_opp_pick, total_wc)
                                    best_opp_pick = max(best_opp_pick, total_bc)

                                best_your_pick_wc = max(best_your_pick_wc, worst_opp_pick)
                                best_your_pick_bc = max(best_your_pick_bc, best_opp_pick)

                            pair_wc = min(pair_wc, best_your_pick_wc)
                            pair_bc = max(pair_bc, best_your_pick_bc)

                        att_options_for_this_opp_def.append({
                            "attackers": list(your_atts),
                            "is_recommended": False,
                            "worst_case_total": pair_wc,
                            "best_case_total": pair_bc,
                        })

                    att_options_for_this_opp_def.sort(
                        key=lambda x: x["worst_case_total"], reverse=True
                    )
                    att_options_for_this_opp_def[0]["is_recommended"] = True
                    opp_responses[opp_def] = att_options_for_this_opp_def

                    best_att_wc = att_options_for_this_opp_def[0]["worst_case_total"]
                    best_att_bc = att_options_for_this_opp_def[0]["best_case_total"]
                    def_wc = min(def_wc, best_att_wc)
                    def_bc = max(def_bc, best_att_bc)

            defender_options.append({
                "player": your_def,
                "is_recommended": False,
                "worst_case_total": def_wc,
                "best_case_total": def_bc,
                "opponent_responses": opp_responses,
            })

        defender_options.sort(key=lambda x: x["worst_case_total"], reverse=True)
        defender_options[0]["is_recommended"] = True
        cache[key] = defender_options
        return (
            max(d["worst_case_total"] for d in defender_options),
            max(d["best_case_total"] for d in defender_options),
        )

    yours_t = tuple(sorted(your_players))
    opps_t = tuple(sorted(opp_players))
    subgame_score(yours_t, opps_t)

    initial_key = ",".join(yours_t) + "|" + ",".join(opps_t)

    elapsed = int((time.time() - start) * 1000)
    pred_str = json.dumps(predictions, sort_keys=True)
    pred_hash = hashlib.sha256(pred_str.encode()).hexdigest()[:8]

    return {
        "round_1": {"defender_options": cache[initial_key]},
        "subgame_lookup": {
            k: {"defender_options": v} for k, v in cache.items() if k != initial_key
        },
        "metadata": {
            "total_scenarios": scenario_count[0],
            "computation_time_ms": elapsed,
            "prediction_hash": pred_hash,
            "team_size": len(your_players),
        },
    }
