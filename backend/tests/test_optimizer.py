"""
Tests for the real optimizer algorithm.

Verifies:
1. Output structure matches the OptimizationResult TypeScript interface.
2. Deterministic (same input → same output).
3. Recommended defender has the highest worst_case_total.
4. Executes in under 10 seconds.
5. total_scenarios ≈ 130,000.
"""

import sys
import time
from pathlib import Path

# Ensure backend/ is on sys.path so `import optimizer` works regardless of
# where pytest is invoked from.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import optimizer  # noqa: E402


# ---------------------------------------------------------------------------
# Fixture: a 5×5 prediction matrix with varied but known values
# ---------------------------------------------------------------------------

YOUR_PLAYERS = ["Alice", "Bob", "Carol", "Dave", "Eve"]
OPP_PLAYERS  = ["E1", "E2", "E3", "E4", "E5"]

PREDICTIONS = {
    "Alice": {"E1": 16, "E2": 12, "E3": 14, "E4": 18, "E5": 10},
    "Bob":   {"E1": 11, "E2": 15, "E3": 13, "E4":  9, "E5": 14},
    "Carol": {"E1": 13, "E2": 10, "E3": 17, "E4": 12, "E5": 11},
    "Dave":  {"E1":  9, "E2": 14, "E3": 11, "E4": 15, "E5": 16},
    "Eve":   {"E1": 14, "E2": 11, "E3": 12, "E4": 13, "E5": 15},
}


def test_optimizer_structure_and_timing():
    """Full structural check + timing assertion (< 10 s)."""
    t0 = time.time()
    result = optimizer.optimize(YOUR_PLAYERS, OPP_PLAYERS, PREDICTIONS)
    elapsed = time.time() - t0

    print(f"\n[timing] optimizer.optimize() completed in {elapsed:.3f}s")

    # ── Timing ────────────────────────────────────────────────────────────────
    assert elapsed < 10.0, f"Optimizer took {elapsed:.1f}s — must be < 10s"

    # ── Top-level keys ────────────────────────────────────────────────────────
    assert set(result.keys()) == {"round_1", "round_2_lookup", "metadata"}

    # ── Metadata ──────────────────────────────────────────────────────────────
    meta = result["metadata"]
    assert set(meta.keys()) == {"total_scenarios", "computation_time_ms", "prediction_hash"}
    print(f"[metadata] total_scenarios = {meta['total_scenarios']}")
    print(f"[metadata] computation_time_ms = {meta['computation_time_ms']}")
    print(f"[metadata] prediction_hash = {meta['prediction_hash']}")

    assert isinstance(meta["total_scenarios"], int)
    assert 120_000 <= meta["total_scenarios"] <= 140_000, (
        f"total_scenarios={meta['total_scenarios']} expected ~130k"
    )
    assert isinstance(meta["computation_time_ms"], int)
    assert isinstance(meta["prediction_hash"], str) and len(meta["prediction_hash"]) > 0

    # ── Round 1 tree ──────────────────────────────────────────────────────────
    r1 = result["round_1"]
    assert "defender_options" in r1
    def_opts = r1["defender_options"]
    assert len(def_opts) == 5, "Must have exactly 5 defender options"

    for opt in def_opts:
        _assert_defender_option(opt, expected_opp_defenders=OPP_PLAYERS)

    # Exactly one recommended defender
    recommended = [o for o in def_opts if o["is_recommended"]]
    assert len(recommended) == 1, "Exactly one defender should be recommended"
    rec_def = recommended[0]
    print(f"[round_1] recommended defender: {rec_def['player']} "
          f"(worst={rec_def['worst_case_total']}, best={rec_def['best_case_total']})")

    # ── Round 2 lookup ────────────────────────────────────────────────────────
    r2_lookup = result["round_2_lookup"]
    assert len(r2_lookup) == 100, f"Expected 100 R2 entries, got {len(r2_lookup)}"

    for key, r2_tree in r2_lookup.items():
        assert "|" in key, f"R2 key missing pipe separator: {key}"
        your_side, opp_side = key.split("|")
        assert len(your_side.split(",")) == 3
        assert len(opp_side.split(",")) == 3
        assert "defender_options" in r2_tree
        r2_def_opts = r2_tree["defender_options"]
        assert len(r2_def_opts) == 3, f"R2 should have 3 defender options, key={key}"
        for opt in r2_def_opts:
            your3 = your_side.split(",")
            opp3  = opp_side.split(",")
            _assert_defender_option(opt, expected_opp_defenders=opp3)


def test_recommended_defender_has_highest_worst_case():
    """The recommended defender must have the strictly highest worst_case_total."""
    result = optimizer.optimize(YOUR_PLAYERS, OPP_PLAYERS, PREDICTIONS)
    def_opts = result["round_1"]["defender_options"]

    recommended = next(o for o in def_opts if o["is_recommended"])
    all_worst = [o["worst_case_total"] for o in def_opts]

    assert recommended["worst_case_total"] == max(all_worst), (
        f"Recommended defender {recommended['player']} has worst_case "
        f"{recommended['worst_case_total']} but max is {max(all_worst)}"
    )
    print(f"\n[maximin] recommended={recommended['player']} "
          f"worst={recommended['worst_case_total']} (max of {all_worst})")


def test_deterministic():
    """Running the optimizer twice must produce identical output."""
    r1 = optimizer.optimize(YOUR_PLAYERS, OPP_PLAYERS, PREDICTIONS)
    r2 = optimizer.optimize(YOUR_PLAYERS, OPP_PLAYERS, PREDICTIONS)

    # Strip computation_time_ms (will differ slightly between runs)
    r1["metadata"].pop("computation_time_ms")
    r2["metadata"].pop("computation_time_ms")

    assert r1 == r2, "Optimizer output is not deterministic!"
    print("\n[determinism] PASS — two runs produced identical output")


def test_total_scenarios_count():
    """total_scenarios should be exactly 129,600."""
    result = optimizer.optimize(YOUR_PLAYERS, OPP_PLAYERS, PREDICTIONS)
    total = result["metadata"]["total_scenarios"]
    print(f"\n[scenarios] total_scenarios = {total}")
    assert total == 129_600, f"Expected 129600, got {total}"


def test_r2_attacker_options_structure():
    """Each R2 defender option should have 2 attacker options per opponent defender."""
    result = optimizer.optimize(YOUR_PLAYERS, OPP_PLAYERS, PREDICTIONS)
    r2_lookup = result["round_2_lookup"]

    sample_key = next(iter(r2_lookup))
    your_side, opp_side = sample_key.split("|")
    opp3 = opp_side.split(",")

    sample_tree = r2_lookup[sample_key]
    for def_opt in sample_tree["defender_options"]:
        for opp_def, atk_opts in def_opt["opponent_responses"].items():
            assert opp_def in opp3
            # 2 counter-pick options per (your_def, opp_def) in R2
            assert len(atk_opts) == 2, (
                f"R2 should have 2 attacker options per (def, opp_def); "
                f"got {len(atk_opts)} for opp_def={opp_def}"
            )
            n_rec = sum(1 for a in atk_opts if a["is_recommended"])
            assert n_rec == 1, "Exactly one attacker option should be recommended"


# ---------------------------------------------------------------------------
# Shared assertion helper
# ---------------------------------------------------------------------------

def _assert_defender_option(opt: dict, expected_opp_defenders: list) -> None:
    assert set(opt.keys()) == {
        "player", "is_recommended", "worst_case_total", "best_case_total",
        "opponent_responses",
    }, f"Unexpected keys in defender option: {opt.keys()}"

    assert isinstance(opt["player"], str)
    assert isinstance(opt["is_recommended"], bool)
    assert isinstance(opt["worst_case_total"], (int, float))
    assert isinstance(opt["best_case_total"], (int, float))
    assert opt["best_case_total"] >= opt["worst_case_total"], (
        f"best_case ({opt['best_case_total']}) < worst_case ({opt['worst_case_total']})"
    )

    opp_resp = opt["opponent_responses"]
    assert isinstance(opp_resp, dict)
    assert set(opp_resp.keys()) == set(expected_opp_defenders), (
        f"opponent_responses keys {set(opp_resp.keys())} != "
        f"expected {set(expected_opp_defenders)}"
    )

    for opp_name, atk_opts in opp_resp.items():
        assert isinstance(atk_opts, list) and len(atk_opts) >= 1
        n_rec = sum(1 for a in atk_opts if a["is_recommended"])
        assert n_rec == 1, (
            f"Exactly one attacker option should be recommended for opp_def={opp_name}"
        )
        for atk in atk_opts:
            assert set(atk.keys()) == {
                "attackers", "is_recommended", "worst_case_total", "best_case_total"
            }, f"Unexpected keys in attacker option: {atk.keys()}"
            assert isinstance(atk["attackers"], list) and len(atk["attackers"]) == 2
            assert isinstance(atk["is_recommended"], bool)
            assert isinstance(atk["worst_case_total"], (int, float))
            assert isinstance(atk["best_case_total"], (int, float))
            assert atk["best_case_total"] >= atk["worst_case_total"]
