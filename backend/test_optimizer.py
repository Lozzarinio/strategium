import requests
import json

BASE_URL = "http://localhost:8000"

print("Creating session...")
session_data = {
    "tournament_id": 1,
    "your_team_id": 1,
    "opponent_team_id": 2,
    "round_number": 1,
    "round_name": "Round 1"
}
response = requests.post(f"{BASE_URL}/sessions", json=session_data)
session = response.json()
session_code = session["code"]
print(f"✓ Session created: {session_code}")

print("\nSubmitting player matrices...")
sample_matrices = {
    "Laurence": {"Jack": 15, "John": 8, "James": 12, "Jim": 6, "Joe": 11},
    "Byron": {"Jack": 9, "John": 14, "James": 10, "Jim": 16, "Joe": 7},
    "Denis": {"Jack": 11, "John": 7, "James": 18, "Jim": 10, "Joe": 13},
    "Sam": {"Jack": 8, "John": 12, "James": 9, "Jim": 13, "Joe": 15},
    "Euan": {"Jack": 13, "John": 16, "James": 6, "Jim": 11, "Joe": 9}
}

for player, matrix in sample_matrices.items():
    response = requests.post(
        f"{BASE_URL}/sessions/{session_code}/matrix",
        json={"player_name": player, "matrix": matrix}
    )
    print(f"✓ {player} submitted matrix")

print("\nRunning optimization...")
response = requests.post(f"{BASE_URL}/sessions/{session_code}/optimize")
result = response.json()

print("\n" + "="*60)
print("RAW RESULT:")
print(json.dumps(result, indent=2))
print("="*60)