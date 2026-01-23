import requests
import json

BASE_URL = "http://localhost:8000"

print("Creating session and submitting matrices...")
session_data = {
    "tournament_id": 1,
    "your_team_id": 1,
    "opponent_team_id": 2,
    "round_number": 1,
    "round_name": "Round 1"
}
response = requests.post(f"{BASE_URL}/sessions", json=session_data)
session_code = response.json()["code"]

# Submit matrices
sample_matrices = {
    "Laurence": {"Jack": 15, "John": 8, "James": 12, "Jim": 6, "Joe": 11},
    "Byron": {"Jack": 9, "John": 14, "James": 10, "Jim": 16, "Joe": 7},
    "Denis": {"Jack": 11, "John": 7, "James": 18, "Jim": 10, "Joe": 13},
    "Sam": {"Jack": 8, "John": 12, "James": 9, "Jim": 13, "Joe": 15},
    "Euan": {"Jack": 13, "John": 16, "James": 6, "Jim": 11, "Joe": 9}
}

for player, matrix in sample_matrices.items():
    requests.post(
        f"{BASE_URL}/sessions/{session_code}/matrix",
        json={"player_name": player, "matrix": matrix}
    )

print(f"Session: {session_code}\n")

# Display the prediction matrices
print("="*60)
print("PREDICTION MATRICES (Your Players vs Opponents)")
print("="*60)
print(f"{'Player':<10} {'Jack':<6} {'John':<6} {'James':<6} {'Jim':<6} {'Joe':<6}")
print("-"*60)
for player, scores in sample_matrices.items():
    print(f"{player:<10} {scores['Jack']:<6} {scores['John']:<6} {scores['James']:<6} {scores['Jim']:<6} {scores['Joe']:<6}")
print()

# Calculate some stats
print("Player Averages (higher = better overall):")
for player, scores in sample_matrices.items():
    avg = sum(scores.values()) / len(scores.values())
    print(f"  {player}: {avg:.1f}/20 average")
print()

print("Opponent Matchup Summary (who struggles vs each opponent):")
opponents = ["Jack", "John", "James", "Jim", "Joe"]
for opp in opponents:
    scores_vs_opp = {player: matrix[opp] for player, matrix in sample_matrices.items()}
    best_player = max(scores_vs_opp.keys(), key=lambda p: scores_vs_opp[p])
    worst_player = min(scores_vs_opp.keys(), key=lambda p: scores_vs_opp[p])
    print(f"  vs {opp}: Best={best_player}({scores_vs_opp[best_player]}), Worst={worst_player}({scores_vs_opp[worst_player]})")
print("\n")

# Test 1: Pick initial defender
print("="*60)
print("STEP 1: Pick your defender (from all 5 players)")
print("="*60)
response = requests.post(
    f"{BASE_URL}/sessions/{session_code}/recommend",
    json={
        "decision_type": "pick_defender",
        "unpaired_your_team": ["Laurence", "Byron", "Denis", "Sam", "Euan"],
        "unpaired_opponent_team": ["Jack", "John", "James", "Jim", "Joe"]
    }
)
result = response.json()
print(f"Recommended Defender: {result['recommendation']}")
print(f"Expected Total Score (out of 100): {result['expected_total_score']}")
print(f"\nAll Defender Options:")
sorted_options = sorted(result['all_options'].items(), key=lambda x: x[1], reverse=True)
for defender, score in sorted_options:
    print(f"  {defender}: {score}/100")
print()

# Simulate: You pick Denis, opponent reveals Jim
your_defender = "Denis"
opponent_defender = "Jim"

# Test 2: Pick attackers
print("="*60)
print(f"STEP 2: Opponent revealed {opponent_defender}, pick your 2 attackers")
print(f"Your defender is: {your_defender}")
print("="*60)
print(f"\nYour team's scores vs {opponent_defender}:")
for player in ["Laurence", "Byron", "Denis", "Sam", "Euan"]:
    if player != your_defender:
        print(f"  {player}: {sample_matrices[player][opponent_defender]}/20")
print()

response = requests.post(
    f"{BASE_URL}/sessions/{session_code}/recommend",
    json={
        "decision_type": "pick_attackers",
        "unpaired_your_team": ["Laurence", "Byron", "Denis", "Sam", "Euan"],
        "unpaired_opponent_team": ["Jack", "John", "James", "Jim", "Joe"],
        "opponent_defender": opponent_defender,
        "your_defender": your_defender
    }
)
result = response.json()
print(f"Recommended Attackers: {result['recommendation']}")
print(f"Expected Total Score (out of 100): {result['expected_total_score']}")
print(f"\nAll Attacker Pair Options:")
sorted_options = sorted(result['all_options'].items(), key=lambda x: x[1], reverse=True)
for attackers, score in sorted_options:
    print(f"  {attackers}: {score}/100")
print()

# Simulate: You pick Byron and Sam, opponent reveals John and Joe as attackers
your_attackers = ["Byron", "Sam"]
opponent_attackers = ["John", "Joe"]

# Test 3: Pick which attacker your defender faces
print("="*60)
print(f"STEP 3: Opponent's attackers are {opponent_attackers}")
print(f"Which should face your defender ({your_defender})?")
print("="*60)
print(f"\n{your_defender}'s scores vs opponent attackers:")
for opp in opponent_attackers:
    print(f"  vs {opp}: {sample_matrices[your_defender][opp]}/20")
print()

response = requests.post(
    f"{BASE_URL}/sessions/{session_code}/recommend",
    json={
        "decision_type": "pick_defender_matchup",
        "unpaired_your_team": ["Laurence", "Byron", "Denis", "Sam", "Euan"],
        "unpaired_opponent_team": ["Jack", "John", "James", "Jim", "Joe"],
        "your_defender": your_defender,
        "opponent_attackers": opponent_attackers
    }
)
result = response.json()
print(f"Recommended: {your_defender} should face {result['recommendation']}")
print(f"Expected Total Score (out of 100): {result['expected_total_score']}")
print(f"\nAll Matchup Options:")
sorted_options = sorted(result['all_options'].items(), key=lambda x: x[1], reverse=True)
for opp, score in sorted_options:
    print(f"  Face {opp}: {score}/100 total expected")