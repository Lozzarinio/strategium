# STRATEGIUM - Product Requirements Document

**Version:** 3.0 (Greenfield - Revised)  
**Date:** March 2026  
**Status:** Ready for Implementation

---

## Project Overview

Strategium is a web application that helps Warhammer 40K team tournament captains optimize player pairings using complete game tree enumeration. The app allows teams to submit matchup predictions and provides captains with optimal pairing strategies through real-time game tree pruning as opponent moves are revealed.

**Key Principle:** The app is an **optimizer and advisor** - it shows recommendations based on mathematical analysis but the captain can always deviate. Recommendations update dynamically based on the captain's *actual* selections, not assumed ones. Physical card selection happens at the table; the app records outcomes and adapts.

**Development Environment:** GitHub Codespaces (cloud-based development)  
**Deployment:** Vercel (frontend) + Render (backend, Starter plan $7/month required for optimizer) + Neon (database)

---

## Core Concept: The Pairing Problem

### Tournament Rules

1. 2 teams of 5 players face off
2. Each player competes 1v1 (5 total games)
3. Each game scored 0-20 points (zero-sum: your score + opponent's score = 20)
4. Team score = sum of all 5 individual scores (max 100)

### Physical Pairing Process

**Round 1 (5 players per side):**
1. Both captains secretly select 1 Defender
2. Simultaneous reveal of defenders (face up)
3. Both captains hand over 2 Attackers to each other (face down - secret)
4. Each captain secretly selects which of the 2 received attackers their defender faces
5. Simultaneous reveal of selections
6. Result: 2 pairings created
7. **CRITICAL:** Non-selected attackers return to pool (they don't pair immediately)

**Round 2 (3 players remaining per side):**
8. Both captains secretly select 1 Defender from 3 remaining
9. Simultaneous reveal of defenders
10. The remaining 2 players automatically become attackers
11. Captains hand over attackers (face down) and secretly select pairings
12. Simultaneous reveal
13. Result: 2 more pairings created
14. The 2 non-selected players automatically pair together (5th pairing)

**Total:** 5 pairings across 2 rounds of selection

**App's Role:** The physical process happens at the tournament table. The app records what actually happens at each step, updates its recommendations based on the remaining possible game tree branches, and tracks the resulting pairings. The captain can follow or ignore recommendations at every step.

---

## Algorithm: Complete Game Tree Enumeration with Pruning

### Core Concept:

The app builds a complete decision tree of ALL possible pairing scenarios upfront, then **prunes impossible branches** in real-time as the captain records what actually happened at the table. This narrows the remaining scenarios and updates recommendations from what's still possible.

### Key Assumption (v1.0):

**Player predictions are treated as 100% accurate.** Each player's predicted score against each opponent is taken as the exact score that game will produce. There is no uncertainty modeling, no probability distributions, and no opponent behaviour modeling. The optimizer simply finds the pairing set that maximizes total team score given these deterministic predictions.

**Future extensibility:** The optimizer backend is designed so that more sophisticated models (uncertainty ranges, opponent strategy modeling, etc.) can be added later without changing the frontend or API contract.

### Why Complete Enumeration:
- Predictions are deterministic (each matchup has one known score)
- We can enumerate ALL possible pairing paths before the round starts
- As the captain records what happened, impossible branches are pruned
- Remaining branches show the best achievable outcomes
- Complete coverage guarantees we find the true optimum

### Approach:
1. **Pre-compute:** Before round starts, enumerate every possible combination:
   - 5 your defenders × 5 opponent defenders = 25 Round 1 starts
   - Each defender pair leads to C(4,2)=6 your attacker pairs × C(4,2)=6 opponent attacker pairs
   - Each attacker combination leads to possible pairing outcomes
   - Recursively solve Round 2 (3 defenders × 3 opponent × attackers)
   - Total: ~130,000 complete scenarios
   
2. **Build a decision tree:** Structure the results as a nested lookup so the frontend can navigate it without further server calls:
   - Level 1: Your defender choice → scores for each option
   - Level 2: Opponent defender (recorded from table) → updated recommendations
   - Level 3: Your attacker pair choice → scores for each option
   - Level 4: Round 1 pairings (recorded from table) → remaining players
   - Level 5: Round 2 defender choice → scores for each option
   - Level 6: Opponent Round 2 defender (recorded) → final recommendations
   - Level 7: Round 2 pairings (recorded) → 5th pairing is automatic

3. **Prune dynamically (frontend):** As captain records actual events in the wizard:
   - Captain selects defender Alice → Only show branches where Alice is defender
   - Opponent reveals defender Jack → Prune to branches with Jack as opponent defender
   - Captain selects attackers Bob, Carol → Prune to those attacker branches
   - Record Round 1 pairings → Prune to that specific outcome, carry remaining players into Round 2
   - At each step, show the best choice from remaining branches

4. **Handle deviations:** When the captain ignores a recommendation:
   - The tree prunes to the branch matching the captain's actual choice
   - New recommendations are computed from the remaining sub-tree
   - The app shows updated predicted scores reflecting the actual path taken
   - No warnings, no judgment — just updated math

### What the Optimizer Computes:

For YOUR choices (defender selection, attacker selection): evaluate all options, rank by total predicted team score, recommend the highest.

For OPPONENT choices (their defender, their attacker selections, their counter-picks): since we don't model opponent strategy in v1.0, we compute **worst-case** (opponent makes the choice that minimizes your score) and **best-case** (opponent makes the choice that maximizes your score). The recommendation is based on **maximizing worst-case score** (conservative strategy — the captain gets at least this much regardless of what the opponent does).

### Key Properties:
- **Deterministic** (same input = same output)
- **Optimal** (provably best worst-case strategy from remaining branches)
- **Complete** (100% coverage of possible scenarios)
- **Adaptive** (recommendations update as captain records what happened)
- **Non-enforcing** (captain can deviate at any step; optimizer adapts)

---

## User Workflows

### 1. Tournament Creation (Captain)

Captain creates tournament with:
- Tournament name
- Number of rounds (1-5)
- Team name
- 5 players (name, faction, email optional)

**IMPORTANT:** Player names are locked at creation. They cannot be edited after the tournament is created (v1.0 limitation).

System auto-generates:
- Single session with unique 6-character code
- N rounds (empty, no opponents assigned yet)

Captain receives session code to share with team.

### 2. Player Setup

- Players join via session code
- Select their name from roster (dropdown of the 5 names created by captain)
- Can update their faction at any time

### 3. Opponent Team Management (Captain)

Captain adds opponent teams to tournament:
- Team name
- 5 players with: name, faction, notes (free text)

Can add as many opponent teams as needed. Opponent teams displayed as collapsible list on dashboard.

### 4. Round Assignment (Captain)

- Captain assigns opponent teams to specific rounds
- Each round can have one opponent team
- Once assigned, players can submit predictions for that round

### 5. Prediction Submission (Players)

- Players select a round (must have opponent assigned)
- View the 5 opponents for that round
- Enter predictions (0-20 points, integers or half-points) for **their own matchups only** (5 values per player)
- Can see teammates' submitted predictions (read-only)
- Captain can edit any player's predictions

**Each player submits only their own row** — their predicted score against each of the 5 opponents. The full 5×5 matrix is assembled from all 5 players' individual submissions.

### 6. Optimization (Captain)

- Captain views round detail (shows assembled 5×5 matrix)
- Clicks "Run Optimizer" when all 5 players have submitted
- System runs complete game tree enumeration (~130,000 scenarios)
- **Requires Render Starter plan ($7/month)** — free tier will timeout
- Returns the complete pre-computed decision tree:
  - Best defender to select initially
  - For each possible opponent defender: best attackers to select
  - For each Round 2 state: best defender to select
  - Predicted scores at every decision point (worst-case and best-case)
  - Total scenarios evaluated

### 7. Pairings Wizard (Captain)

After optimization completes, the captain uses an interactive wizard during the actual pairing process at the tournament table. The wizard shows recommendations and records what actually happens as pairings are made physically.

**CRITICAL ARCHITECTURE DECISION:** The wizard runs entirely in the frontend. The pre-computed decision tree is delivered once by the optimizer endpoint and stored in the browser (React state + localStorage for refresh persistence). No server round-trips during the wizard. A single POST is made at completion to record the final pairings.

This means the wizard works even if the Render backend goes to sleep mid-tournament, and there's no latency between steps.

#### Wizard Flow (8 Steps):

**Step 1: Select Your Defender (Round 1)**
- View optimizer's recommended defender with predicted score
- Dropdown showing all 5 players
- If captain selects a different player, optimizer updates recommendations based on that choice
- "Confirm Defender" button

**Step 2: Record Opponent's Revealed Defender**
- *Physical process has happened: opponent revealed their defender at the table*
- Dropdown showing all 5 opponent players
- Captain selects whoever the opponent actually revealed
- Frontend prunes decision tree (removes branches where opponent chose someone else)
- Shows updated attacker recommendation
- "Continue" button

**Step 3: Select Your 2 Attackers**
- Optimizer shows recommended attackers based on confirmed defenders
- Select exactly 2 from remaining 4 players
- Remaining 2 players shown as "staying in pool"
- Show predicted score for the selected pair
- If captain deviates from recommendation, predicted scores update
- "Confirm Attackers" button

**Step 4: Record Round 1 Pairings**
- *Physical process has happened: attackers exchanged face-down, secret selection, simultaneous reveal*
- Captain records the 2 pairings that actually resulted:
  - Pairing 1: [Your Defender] vs [dropdown: one of the 2 opponent attackers]
  - Pairing 2: [Your Attacker sent to opponent] vs [Opponent Defender]
- **Dropdowns only show eligible players** (the defender and attackers involved in this round)
- Show predicted scores for each recorded pairing
- Display running total from 2 pairings
- Show remaining 3 players per side entering Round 2
- "Continue to Round 2" button

**Step 5: Select Your Defender (Round 2)**
- Only remaining 3 players shown in dropdown
- Shows which 2 will automatically become attackers based on selection
- Optimizer recommendation based on remaining players and pruned tree
- "Confirm Defender" button

**Step 6: Record Opponent's Revealed Defender (Round 2)**
- *Physical process has happened: opponent revealed Round 2 defender*
- Dropdown showing remaining 3 opponent players
- Remaining 2 opponents automatically become attackers (displayed)
- Frontend prunes tree further
- "Continue" button

**Step 7: Record Round 2 Pairings**
- *Physical process has happened: same face-down attacker exchange and secret selection*
- Captain records the 2 pairings that resulted:
  - Pairing 3: [Your Defender] vs [dropdown: one of 2 opponent attackers]
  - Pairing 4: [Your Attacker] vs [Opponent Defender]
- **Dropdowns only show eligible players** for this round
- Show predicted scores
- Display running total from 4 pairings
- "Continue to Final Pairing" button

**Step 8: Final Pairing (Automatic)**
- System automatically creates Pairing 5 from the 2 remaining players
- Display all 5 final pairings:
  1. [Player] vs [Opponent] - Predicted: [Score] pts
  2. [Player] vs [Opponent] - Predicted: [Score] pts
  3. [Player] vs [Opponent] - Predicted: [Score] pts
  4. [Player] vs [Opponent] - Predicted: [Score] pts
  5. [Player] vs [Opponent] - Predicted: [Score] pts
  
  **Total Predicted Score: X points**
  **vs Best Possible: Y points** (if all recommendations were followed)
  
- "Save & Complete" button → single POST to backend to record final pairings

#### Wizard UI Requirements:

**Must Have:**
- Progress indicator (Step X of 8)
- Visual stepper with checkmarks for completed steps
- Recommendations prominently displayed with clear visual hierarchy
- Predicted scores at each decision point
- Dropdowns that only show eligible/available players at each step
- Running total in sticky header showing cumulative predicted score
- State persistence via localStorage (survives page refresh)
- Back navigation (review previous steps, read-only)
- Validation (can't proceed with invalid/incomplete selections)
- Clear distinction between "App recommends X" vs "Record what happened"

**Nice to Have (v2.0):**
- Explanation of why recommendation is optimal
- Show tree pruning visually (X scenarios → Y scenarios remaining)
- Warning when deviating significantly from optimal
- Undo/restart wizard

---

## Technical Requirements

### Tech Stack

**Frontend:**
- React 18+
- TypeScript
- Tailwind CSS (dark theme, red accent: #e94560)
- Vite build tool
- Fetch API for HTTP
- localStorage for wizard state persistence
- Deployed on Vercel (free tier)

**Backend:**
- Python 3.11+
- FastAPI
- SQLAlchemy ORM
- Pydantic validation
- Deployed on Render (**Starter plan, $7/month** — required for optimizer computation)

**Database:**
- PostgreSQL via Neon (serverless)
- 3GB storage (free forever)

**Development:**
- GitHub Codespaces
- Port 8000: Backend (set to PUBLIC visibility in Codespaces)
- Port 5173: Frontend (Vite)

---

## Database Schema

### Core Tables

**tournaments**
```sql
id SERIAL PRIMARY KEY
name VARCHAR(255) NOT NULL
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**teams** (Your Team - exactly 1 per tournament)
```sql
id SERIAL PRIMARY KEY
tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE
name VARCHAR(255) NOT NULL
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**players** (Your Team - exactly 5 per team, names locked at creation)
```sql
id SERIAL PRIMARY KEY
team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE
name VARCHAR(255) NOT NULL
faction VARCHAR(255)
email VARCHAR(255)
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**opponent_teams** (Reusable across rounds)
```sql
id SERIAL PRIMARY KEY
tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE
name VARCHAR(255) NOT NULL
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**opponent_players** (exactly 5 per opponent team)
```sql
id SERIAL PRIMARY KEY
team_id INTEGER NOT NULL REFERENCES opponent_teams(id) ON DELETE CASCADE
name VARCHAR(255) NOT NULL
faction VARCHAR(255)
notes TEXT
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**sessions** (exactly 1 per tournament)
```sql
id SERIAL PRIMARY KEY
tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE
code VARCHAR(6) UNIQUE NOT NULL
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**rounds** (N per session, typically 5)
```sql
id SERIAL PRIMARY KEY
session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE
round_number INTEGER NOT NULL
opponent_team_id INTEGER REFERENCES opponent_teams(id) ON DELETE SET NULL
predictions JSON DEFAULT '{}'  -- Stores predictions: {player_name: {opponent_name: score}}
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**completed_pairings** (Final wizard results - one record per completed wizard)
```sql
id SERIAL PRIMARY KEY
round_id INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE
pairings JSON NOT NULL  -- [{your_player, opponent_player, predicted_score}, x5]
total_predicted_score FLOAT NOT NULL
optimization_best_score FLOAT  -- What was achievable if all recommendations followed
completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

### Indexes
```sql
CREATE INDEX idx_teams_tournament ON teams(tournament_id);
CREATE INDEX idx_players_team ON players(team_id);
CREATE INDEX idx_opponent_teams_tournament ON opponent_teams(tournament_id);
CREATE INDEX idx_opponent_players_team ON opponent_players(team_id);
CREATE UNIQUE INDEX idx_sessions_code ON sessions(code);
CREATE INDEX idx_sessions_tournament ON sessions(tournament_id);
CREATE INDEX idx_rounds_session ON rounds(session_id);
CREATE INDEX idx_completed_pairings_round ON completed_pairings(round_id);
```

### Key Schema Decisions

**Why no pairing_sessions table for wizard state?**
The wizard runs entirely in the frontend using React state + localStorage. This eliminates server round-trips during the time-critical tournament table process and means the wizard works even if the backend is asleep. Only the final result is POSTed to `completed_pairings`.

**Why JSON for predictions?**
- Flexible 5x5 structure
- Atomic updates per player row
- Simple to query
- Can refactor to separate table later if needed

**Why separate opponent_teams?**
- Reusable across rounds
- Pre-load many opponents before tournament
- Single management interface

---

## API Endpoints

### Base URL
- Development: `http://localhost:8000/api/v1`
- Production: `https://strategium-backend.onrender.com/api/v1`

All endpoints are prefixed with `/api/v1/`. This allows future API versions (e.g., `/api/v2/`) to coexist without breaking existing clients.

### Tournament Management

```http
POST /api/v1/tournaments
{
  "name": "Bay Area Bash 2026",
  "num_rounds": 5,
  "team": {
    "name": "Fire and Dice",
    "players": [
      {"name": "Alice", "faction": "Space Marines", "email": "alice@example.com"},
      {"name": "Bob", "faction": "Orks"},
      {"name": "Carol", "faction": "Necrons"},
      {"name": "Dave", "faction": "Tau"},
      {"name": "Eve", "faction": "Tyranids"}
    ]
  }
}

Response 201:
{
  "id": 1,
  "name": "Bay Area Bash 2026",
  "created_at": "2026-03-26T10:00:00Z",
  "team": {
    "id": 1,
    "name": "Fire and Dice",
    "players": [...]
  },
  "session": {
    "id": 1,
    "code": "A7X2K9",
    "rounds": [
      {"id": 1, "round_number": 1, "opponent_team_id": null, "predictions": {}},
      ...
    ]
  },
  "opponent_teams": []
}

GET /api/v1/tournaments
GET /api/v1/tournaments/{id}
DELETE /api/v1/tournaments/{id}
```

### Session & Predictions

```http
GET /api/v1/sessions/{code}
Response: Session details with team and rounds

POST /api/v1/sessions/{code}/predictions
{
  "player_name": "Alice",
  "round_number": 1,
  "predictions": {
    "Opponent1": 15,
    "Opponent2": 12,
    "Opponent3": 18,
    "Opponent4": 10,
    "Opponent5": 14
  }
}

Validation:
- player_name MUST match one of the 5 players created with the tournament
- Each score must be 0-20 (integers or half-points e.g. 12.5)
- All 5 opponents must be included
- Returns 400 if player_name does not match roster

GET /api/v1/rounds/{round_id}/predictions
Response: {
  "predictions": {
    "Alice": {"Opponent1": 15, ...},
    "Bob": {...}
  },
  "complete": true,
  "missing_players": []
}
```

### Opponent Teams

```http
POST /api/v1/tournaments/{tournament_id}/opponent-teams
{
  "name": "Thunder Warriors",
  "players": [
    {"name": "Enemy1", "faction": "Chaos", "notes": "Strong melee"},
    {"name": "Enemy2", "faction": "Chaos"},
    {"name": "Enemy3", "faction": "Chaos"},
    {"name": "Enemy4", "faction": "Chaos"},
    {"name": "Enemy5", "faction": "Chaos"}
  ]
}

GET /api/v1/tournaments/{tournament_id}/opponent-teams
GET /api/v1/opponent-teams/{team_id}
PUT /api/v1/opponent-teams/{team_id}
DELETE /api/v1/opponent-teams/{team_id}
```

### Rounds

```http
PUT /api/v1/rounds/{round_id}
{
  "opponent_team_id": 1
}

GET /api/v1/rounds/{round_id}
```

### Optimization

```http
POST /api/v1/rounds/{round_id}/optimize

Response 200:
See TypeScript OptimizationResult interface in Architecture document for the
complete response shape. Summary:

{
  "round_1": {
    "defender_options": [
      {
        "player": "Alice",
        "is_recommended": true,
        "worst_case_total": 66.5,
        "best_case_total": 72.0,
        "opponent_responses": {
          "Enemy1": {
            "attacker_options": [
              {
                "attackers": ["Bob", "Carol"],
                "is_recommended": true,
                "worst_case_total": 67.2,
                "best_case_total": 72.0
              }
            ]
          }
        }
      }
    ]
  },
  "round_2_lookup": { ... },
  "metadata": {
    "total_scenarios": 129600,
    "computation_time_ms": 4200,
    "prediction_hash": "abc123"
  }
}
```

### Completed Pairings

```http
POST /api/v1/rounds/{round_id}/completed-pairings
{
  "pairings": [
    {"your_player": "Alice", "opponent_player": "Enemy3", "predicted_score": 18},
    {"your_player": "Bob", "opponent_player": "Enemy1", "predicted_score": 14},
    {"your_player": "Carol", "opponent_player": "Enemy5", "predicted_score": 16},
    {"your_player": "Dave", "opponent_player": "Enemy2", "predicted_score": 12},
    {"your_player": "Eve", "opponent_player": "Enemy4", "predicted_score": 10}
  ],
  "total_predicted_score": 70,
  "optimization_best_score": 72
}

GET /api/v1/rounds/{round_id}/completed-pairings
```

---

## Frontend Components

### Required Pages

**HomePage.tsx**
- Landing page
- Tournament list
- "Create Tournament" button

**TournamentCreate.tsx**
- Tournament creation form
- Team setup (name + 5 players)
- Display session code after creation

**TournamentDashboard.tsx** (Captain View)
- Tournament overview
- Opponent team management
- Round list with assignments
- Session code display

**RoundDetail.tsx**
- Prediction matrix view (5x5 grid, assembled from individual player submissions)
- Prediction status (who has submitted)
- "Run Optimizer" button (enabled when all 5 players submitted)
- Optimization results display (summary view)
- "Start Pairing Wizard" button

**PlayerView.tsx**
- Session code entry
- Player name selection (dropdown of 5 names from roster)
- Round selector
- Player's own prediction row (5 inputs, 0-20 each)
- Read-only view of teammates' submissions
- Submit button

**PairingWizard.tsx** - CORE COMPONENT
- 8-step wizard with progress indicator
- Receives full decision tree from optimizer (stored in React state + localStorage)
- Step-by-step recommendations display
- Dropdowns that filter to only eligible/available players at each step
- Records actual physical outcomes
- Updates recommendations when captain deviates
- Running score total
- Summary view at completion
- Single POST to save final pairings

---

## Optimizer Requirements

### What It Must Do

**1. Complete Game Tree Enumeration:**
- Enumerate all possible pairing paths before round starts:
  - 5 your defenders x 5 opponent defenders = 25 Round 1 branches
  - Each branch: C(4,2)=6 your attacker pairs x C(4,2)=6 opponent pairs = 36 combinations
  - Each attacker combo leads to possible pairing outcomes (who faces whom)
  - Recursively solve Round 2 (3 defenders x 3 x auto-attackers)
- Total: ~130,000 complete scenarios

**2. Score Calculation:**
- Use prediction matrix: `predictions[your_player][opponent_player]`
- For each complete path (set of 5 pairings), sum all 5 predicted scores
- Predictions are treated as 100% accurate (no uncertainty)

**3. Strategy Computation:**
- For YOUR decision nodes: evaluate all options, rank by score
- For OPPONENT decision nodes: compute worst-case (opponent minimizes your score) and best-case (opponent maximizes your score)
- Recommendation = the choice that **maximizes your worst-case total score**
- This is a conservative (maximin) strategy — guarantees the best floor

**4. Output a Decision Tree:**
- Structured as a nested lookup (see API response shape and TypeScript interface)
- Round 1: defender options → opponent responses → attacker options
- Round 2: keyed by remaining players → defender options → opponent responses
- Frontend can navigate the tree locally without server calls

**5. Performance:**
- Initial enumeration: target <10 seconds (130k scenarios with simple arithmetic is fast)
- Tree serialization to JSON: <1 second
- Deterministic (same input = same output)
- No randomness

**6. Memoization:**
- Round 2 solutions can be memoized by remaining-player set
- C(5,3) x C(5,3) = 100 unique Round 2 states
- Each state has 3 x 3 x 4 = 36 outcomes to evaluate
- This makes the total computation very efficient

---

## Deployment Configuration

### Frontend (Vercel)

**Setup:**
1. Connect GitHub repo to Vercel
2. Set root directory: `frontend`
3. Build command: `npm run build`
4. Output directory: `dist` (Vite)

**Environment Variables:**
```
VITE_API_URL=https://strategium-backend.onrender.com/api/v1
```

**Cost:** Free forever

---

### Backend (Render)

**Starter Plan Required ($7/month)**

The optimizer endpoint runs a computation over ~130,000 scenarios. Render's free tier has:
- 30-second request timeout (optimizer may need up to 10s, but cold start + computation can exceed 30s)
- 512MB RAM with spin-down after 15 minutes
- 30-second cold start before any computation begins

The Starter plan ($7/month) provides:
- Always-on (no cold starts)
- No request timeout issues
- Sufficient RAM for the computation

**Recommendation:** Start development on free tier for basic CRUD endpoints. Switch to Starter plan when you begin testing the optimizer endpoint.

**Setup via render.yaml:**
```yaml
services:
  - type: web
    name: strategium-backend
    env: python
    region: oregon
    plan: starter
    buildCommand: |
      cd backend
      pip install -r requirements.txt
    startCommand: |
      cd backend
      uvicorn main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: DATABASE_URL
        value: [Neon connection string]
      - key: CORS_ORIGINS
        value: https://strategium.vercel.app,http://localhost:5173
```

**Cost:** $7/month (Starter, always-on)

---

### Database (Neon)

**Setup:**
1. Create account at neon.tech
2. Create project: "Strategium"
3. Get connection string

**Connection String:**
```
postgresql://user:pass@ep-xxxxx.neon.tech/strategium?sslmode=require
```

**Cost:** Free forever (3GB storage)

---

## Development Workflow

### Local Setup (Codespaces)

**Terminal 1 - Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Environment:**
- Backend: `http://localhost:8000`
- Frontend: `http://localhost:5173`
- Database: Neon connection string in `.env`

**IMPORTANT Codespaces Configuration:**
- Port 8000: Set visibility to **PUBLIC** (not Private)
- This prevents CORS issues during development

### Testing Flow

1. Captain creates tournament → Get session code
2. Captain adds opponent team → Assign to round
3. Players (5x) join via code → Submit predictions (own row only)
4. Captain views round → Run optimizer
5. Captain reviews optimization results (decision tree)
6. Captain starts pairing wizard (decision tree loaded into frontend)
7. During physical pairing at table:
   - Select/record choices in wizard (all frontend, no server calls)
   - View updated recommendations
   - Record actual pairings as they happen
8. Complete wizard → Single POST saves final 5 pairings to backend

---

## Success Criteria

The project is complete when:

- Captain can create tournament with team of 5 players (names locked)
- 5 players can join via session code and submit their own predictions
- Captain can manage opponent teams and assign to rounds
- Captain can edit any player's predictions
- Optimizer enumerates complete game tree in <10 seconds
- Optimizer returns a navigable decision tree to the frontend
- Pairings Wizard runs entirely in the frontend (no server calls between steps)
- Wizard shows updated recommendations as captain records actual events
- Wizard dropdowns only show eligible/available players at each step
- Captain can deviate from recommendations; optimizer adapts
- Same predictions produce same optimization output (deterministic)
- Complete wizard saves final 5 pairings via single POST
- Deployed to production (Vercel + Render Starter + Neon)
- Full end-to-end flow works from creation → predictions → optimization → wizard → saved pairings

---

## Known Scope Exclusions (v1.0)

**Not Building:**
- User authentication / login system
- Email notifications
- Real-time updates (WebSockets)
- Mobile native apps
- Tournament history/analytics
- PDF export
- Undo wizard steps
- Multiple sessions per tournament
- Editing player names after tournament creation
- Editing/resetting wizard mid-way (start over by re-entering wizard)
- Colour-coded prediction scores (add later)
- Uncertainty modeling in optimizer
- Opponent strategy modeling in optimizer

**Can Add Later (v2.0):**
- User accounts (OAuth)
- Email invites for players
- Historical tournament tracking
- Colour-coded predictions (Red/Orange/Green)
- Uncertainty ranges on predictions
- Opponent behaviour modeling (minimax vs random)
- Optimistic/pessimistic strategy toggle
- AI-powered prediction suggestions
- Mobile app
- Advanced analytics
- Tournament templates
- Wizard undo/restart

---

## Key Design Decisions

**Why complete enumeration?**
- Predictions are deterministic (each matchup has one known score)
- Complete enumeration guarantees we find the true optimum
- ~130k scenarios is trivially fast to compute (<10s)
- 100% coverage, not a statistical estimate

**Why does the wizard run in the frontend?**
- Eliminates server round-trips during time-critical tournament table process
- Works even if Render backend is asleep or slow
- Zero latency between wizard steps
- Decision tree is pre-computed and delivered once
- Only final pairings need to be saved (single POST)

**Why maximin (maximise worst-case)?**
- Conservative strategy that guarantees a minimum score floor
- Does not require modeling opponent intelligence
- Appropriate default for competitive play
- Can add optimistic/aggressive modes later

**Why session codes vs authentication?**
- v1.0 scope control
- Simpler implementation
- Trust-based model appropriate for team tournaments
- Can add authentication in v2.0

**Why Render Starter plan?**
- Free tier has 30s request timeout and cold starts
- Optimizer needs reliable compute without timeout risk
- $7/month is minimal for always-on backend
- Start on free tier during CRUD development, upgrade when optimizer is ready

**Why Neon vs other databases?**
- Free forever (not 90-day trial)
- 3GB storage (plenty for use case)
- True PostgreSQL (no vendor-specific SQL)
- Auto-pause acceptable for tournament use case

---

**Document Version:** 3.0 (Greenfield - Revised)  
**Last Updated:** March 2026  
**Status:** Ready to Build
