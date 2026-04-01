# STRATEGIUM - Technical Architecture Document

**Version:** 2.0 (Greenfield - Revised)  
**Date:** March 2026  
**Status:** Ready for Implementation  
**Canonical Reference:** GREENFIELD_REQUIREMENTS_v3.md (requirements take precedence)

---

## 1. System Architecture

### 1.1 High-Level Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                        Client Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │   Desktop   │  │   Tablet    │  │   Mobile    │           │
│  │   Browser   │  │   Browser   │  │   Browser   │           │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘           │
│         └─────────────────┴─────────────────┘                  │
│                           │                                    │
│                      HTTPS/JSON                                │
│                           │                                    │
│                    ┌──────▼──────┐                             │
│                    │   Vercel    │                             │
│                    │   CDN/Edge  │                             │
│                    │  React SPA  │                             │
│                    │ + Wizard    │  ◄── Decision tree stored   │
│                    │   State     │      in React state +       │
│                    │             │      localStorage           │
│                    └──────┬──────┘                             │
│                           │                                    │
│                      HTTPS/JSON                                │
│                      (NOT during wizard -                      │
│                       only before & after)                     │
│                           │                                    │
│                    ┌──────▼──────┐                             │
│                    │  Render.com │                             │
│                    │  Starter    │  ◄── $7/month required      │
│                    │   FastAPI   │      for optimizer           │
│                    │ + Optimizer │                             │
│                    └──────┬──────┘                             │
│                           │                                    │
│                      SQL over SSL                              │
│                           │                                    │
│                    ┌──────▼──────┐                             │
│                    │    Neon     │                             │
│                    │  Serverless │                             │
│                    │  PostgreSQL │                             │
│                    │   3GB Free  │                             │
│                    └─────────────┘                             │
└────────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

| Layer | Technology | Version | Purpose | Hosting |
|-------|-----------|---------|---------|---------|
| **Frontend** | React | 18.2+ | UI framework | Vercel |
| | TypeScript | 5.x | Type safety | Vercel |
| | Tailwind CSS | 4.x | Styling | Vercel |
| | Vite | 6.x | Build tool | Vercel |
| | Fetch API | - | HTTP client | Browser |
| | localStorage | - | Wizard state persistence | Browser |
| **Backend** | Python | 3.11+ | Runtime | Render |
| | FastAPI | 0.109+ | API framework | Render |
| | SQLAlchemy | 2.0+ | ORM | Render |
| | Pydantic | 2.5+ | Validation | Render |
| | uvicorn | 0.27+ | ASGI server | Render |
| **Database** | PostgreSQL | 15+ | Data storage | Neon |
| **Dev Env** | Codespaces | - | Cloud IDE | GitHub |

---

## 2. Database Schema

### 2.1 Entity Relationship Diagram

```
tournaments (1) ─┬─> teams (1) ──> players (5, names locked)
                 ├─> sessions (1) ──> rounds (N)
                 └─> opponent_teams (N) ──> opponent_players (5)

rounds (N) ──> opponent_teams (1, optional)
rounds (N) ──> completed_pairings (0..1, written at wizard completion)
```

### 2.2 Complete Schema

```sql
-- Core tournament
CREATE TABLE tournaments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Your team
CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Your players (names locked at creation)
CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    faction VARCHAR(255),
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Opponent teams
CREATE TABLE opponent_teams (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Opponent players
CREATE TABLE opponent_players (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES opponent_teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    faction VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Session (one per tournament)
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    code VARCHAR(6) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rounds (typically 5 per session)
CREATE TABLE rounds (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    opponent_team_id INTEGER REFERENCES opponent_teams(id) ON DELETE SET NULL,
    predictions JSON DEFAULT '{}',  -- {player_name: {opponent_name: score}}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Completed pairings (final wizard output only)
CREATE TABLE completed_pairings (
    id SERIAL PRIMARY KEY,
    round_id INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
    pairings JSON NOT NULL,  -- [{your_player, opponent_player, predicted_score}, x5]
    total_predicted_score FLOAT NOT NULL,
    optimization_best_score FLOAT,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_teams_tournament ON teams(tournament_id);
CREATE INDEX idx_players_team ON players(team_id);
CREATE INDEX idx_opponent_teams_tournament ON opponent_teams(tournament_id);
CREATE INDEX idx_opponent_players_team ON opponent_players(team_id);
CREATE UNIQUE INDEX idx_sessions_code ON sessions(code);
CREATE INDEX idx_sessions_tournament ON sessions(tournament_id);
CREATE INDEX idx_rounds_session ON rounds(session_id);
CREATE INDEX idx_completed_pairings_round ON completed_pairings(round_id);
```

### 2.3 Key Design Decisions

**Why no pairing_sessions table for wizard state?**
The wizard runs entirely in the frontend using React state + localStorage. This eliminates server round-trips during the time-critical tournament table process and means the wizard works even if the backend is asleep. Only the final result is POSTed to `completed_pairings`.

**Why JSON for predictions?**
- Flexible 5×5 structure
- Atomic updates per player row
- Simple to query
- Can refactor to separate table later if needed

**Why separate opponent_teams?**
- Reusable across rounds
- Pre-load many opponents
- Single management interface

---

## 3. API Design

### 3.1 Base Configuration

**URLs:**
- Production: `https://strategium-backend.onrender.com/api/v1`
- Development: `http://localhost:8000/api/v1`

All endpoints are prefixed with `/api/v1/`.

**CORS:**
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://strategium.vercel.app",
        "http://localhost:5173"  # Vite dev server
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 3.2 Core Endpoints

#### Tournaments

```http
POST /api/v1/tournaments
{
  "name": "Bay Area Bash 2026",
  "num_rounds": 5,
  "team": {
    "name": "Fire and Dice",
    "players": [
      {"name": "Alice", "faction": "Space Marines", "email": "alice@example.com"},
      ...
    ]
  }
}

Response 201:
{
  "id": 1,
  "name": "Bay Area Bash 2026",
  "team": {...},
  "session": {
    "id": 1,
    "code": "A7X2K9",
    "rounds": [...]
  }
}
```

```http
GET /api/v1/tournaments/{id}
GET /api/v1/tournaments
DELETE /api/v1/tournaments/{id}
```

#### Predictions

```http
POST /api/v1/sessions/{code}/predictions
{
  "player_name": "Alice",
  "round_number": 1,
  "predictions": {
    "Opponent1": 15,
    "Opponent2": 12,
    ...
  }
}

GET /api/v1/rounds/{round_id}/predictions
Response: {"predictions": {"Alice": {...}, "Bob": {...}}, "complete": true, "missing_players": []}
```

#### Optimization

```http
POST /api/v1/rounds/{round_id}/optimize

Response 200: OptimizationResult (see TypeScript interface below)
```

#### Completed Pairings

```http
POST /api/v1/rounds/{round_id}/completed-pairings
GET /api/v1/rounds/{round_id}/completed-pairings
```

### 3.3 Error Handling

**Standard Error:**
```json
{
  "detail": "Error message"
}
```

**Status Codes:**
- 200 - Success
- 201 - Created
- 400 - Bad Request (validation, e.g. player_name not in roster)
- 404 - Not Found
- 500 - Internal Server Error

---

## 4. Backend Architecture

### 4.1 Project Structure

```
backend/
├── main.py              # FastAPI app + all endpoints
├── models.py            # SQLAlchemy models
├── schemas.py           # Pydantic schemas
├── database.py          # Database connection
├── optimizer.py         # Game tree algorithm
├── requirements.txt     # Dependencies
└── tests/
    ├── test_api.py
    ├── test_optimizer.py
    └── conftest.py
```

### 4.2 Key Files

**database.py** - Connection setup:
```python
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv("DATABASE_URL")

# Ensure SSL for Neon
if DATABASE_URL and "neon.tech" in DATABASE_URL:
    if "sslmode" not in DATABASE_URL:
        DATABASE_URL += "?sslmode=require"

engine = create_engine(
    DATABASE_URL,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=3600
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

**models.py** - SQLAlchemy models for all 7 tables

**schemas.py** - Pydantic models for request/response validation

**main.py** - FastAPI app with all endpoints

**optimizer.py** - Game tree enumeration algorithm

### 4.3 Optimizer Algorithm

**Core Data Structures:**
```python
from dataclasses import dataclass, field
from typing import List, Dict, Tuple, Optional

@dataclass
class PairingOutcome:
    your_player: str
    opponent_player: str
    predicted_score: float

@dataclass
class AttackerOption:
    attackers: Tuple[str, str]
    is_recommended: bool
    worst_case_total: float
    best_case_total: float

@dataclass
class OpponentResponse:
    opponent_defender: str
    attacker_options: List[AttackerOption]

@dataclass
class DefenderOption:
    player: str
    is_recommended: bool
    worst_case_total: float
    best_case_total: float
    opponent_responses: Dict[str, List[AttackerOption]]
```

**Algorithm Overview (Maximin — NOT Expectimax):**

The optimizer uses a maximin strategy: for your decisions it picks the option that maximizes score; for opponent decisions it assumes the worst case (opponent minimizes your score). This guarantees a score floor regardless of opponent behaviour.

```python
def optimize(your_players, opponent_players, predictions):
    """
    Build complete decision tree with maximin scoring.
    
    YOUR nodes: pick MAX score option
    OPPONENT nodes: assume MIN score (worst case for you)
    
    Returns: OptimizationResult with full decision tree
    """
    round_1_options = []
    round_2_cache = {}  # Memoize by remaining player sets
    
    for your_defender in your_players:
        defender_worst = float('inf')
        defender_best = float('-inf')
        opponent_responses = {}
        
        for opp_defender in opponent_players:
            your_remaining = [p for p in your_players if p != your_defender]
            opp_remaining = [p for p in opponent_players if p != opp_defender]
            
            attacker_options = []
            for your_attackers in combinations(your_remaining, 2):
                # Evaluate all possible Round 1 pairing outcomes
                # and recursively solve Round 2 for each
                worst, best = evaluate_attacker_choice(
                    your_defender, opp_defender,
                    your_attackers, opp_remaining,
                    predictions, round_2_cache
                )
                attacker_options.append({
                    "attackers": your_attackers,
                    "worst_case_total": worst,
                    "best_case_total": best,
                })
            
            # Rank attacker options by worst-case (maximin)
            attacker_options.sort(key=lambda x: x["worst_case_total"], reverse=True)
            attacker_options[0]["is_recommended"] = True
            opponent_responses[opp_defender] = attacker_options
            
            # Defender-level worst/best accounts for all opponent defenders
            best_attacker = attacker_options[0]
            defender_worst = min(defender_worst, best_attacker["worst_case_total"])
            defender_best = max(defender_best, best_attacker["best_case_total"])
        
        round_1_options.append({
            "player": your_defender,
            "worst_case_total": defender_worst,
            "best_case_total": defender_best,
            "opponent_responses": opponent_responses,
        })
    
    # Rank defender options by worst-case (maximin)
    round_1_options.sort(key=lambda x: x["worst_case_total"], reverse=True)
    round_1_options[0]["is_recommended"] = True
    
    # Build round_2_lookup from cache
    round_2_lookup = build_round_2_lookup(round_2_cache)
    
    return {
        "round_1": {"defender_options": round_1_options},
        "round_2_lookup": round_2_lookup,
        "metadata": {...}
    }
```

**Round 2 Memoization:**
```python
def get_round_2_key(your_remaining, opp_remaining):
    """Create lookup key from sorted remaining player names."""
    your_key = ",".join(sorted(your_remaining))
    opp_key = ",".join(sorted(opp_remaining))
    return f"{your_key}|{opp_key}"

# Only C(5,3) x C(5,3) = 100 unique Round 2 states
# Each solved once, reused across all Round 1 branches
```

**Performance:**
- ~130,000 total scenarios
- Each scenario: 5 dictionary lookups + 5 additions
- Round 2 memoization reduces redundant work dramatically
- Target: <10 seconds total
- Deterministic: same input always produces same output

---

## 5. Frontend Architecture

### 5.1 Project Structure

```
frontend/
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── api/
    │   └── client.ts
    ├── types/
    │   └── optimization.ts    # TypeScript interfaces
    ├── hooks/
    │   └── useWizardState.ts  # Wizard state + localStorage
    └── components/
        ├── HomePage.tsx
        ├── TournamentCreate.tsx
        ├── TournamentDashboard.tsx
        ├── RoundDetail.tsx
        ├── PlayerView.tsx
        └── PairingWizard/
            ├── PairingWizard.tsx
            ├── WizardStep.tsx
            ├── ProgressStepper.tsx
            └── RecommendationCard.tsx
```

### 5.2 Component Hierarchy

```
App
├── HomePage
│   └── TournamentList
│
├── TournamentCreate
│   └── TeamForm (name + 5 players, locked after creation)
│
├── TournamentDashboard (Captain)
│   ├── OpponentTeamManager
│   ├── RoundList
│   └── RoundDetail
│       ├── PredictionMatrix (read-only assembled 5×5 grid)
│       ├── PredictionStatus (who submitted)
│       └── OptimizerControls (Run / View Results / Start Wizard)
│
├── PlayerView
│   ├── SessionJoin (code entry)
│   ├── PlayerSelector (dropdown of 5 names)
│   └── PredictionRow (5 inputs for own matchups only)
│
└── PairingWizard (8 steps, runs entirely in frontend)
    ├── ProgressStepper (Step X of 8)
    ├── RecommendationCard
    ├── PlayerDropdown (filtered to eligible players)
    └── ScoreSummary (running total)
```

### 5.3 TypeScript Interfaces for Optimization Result

These interfaces define the contract between backend and frontend. The backend must produce this shape; the frontend consumes it.

```typescript
// src/types/optimization.ts

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
```

### 5.4 Wizard State Management

The wizard runs entirely in the frontend. State is managed via a custom React hook:

```typescript
// src/hooks/useWizardState.ts (conceptual outline)

interface WizardState {
  currentStep: number;               // 1-8
  optimizationResult: OptimizationResult;
  
  // Round 1 selections
  round1YourDefender: string | null;
  round1OpponentDefender: string | null;
  round1YourAttackers: [string, string] | null;
  round1Pairings: PairingRecord[] | null;  // 2 pairings
  
  // Round 2 selections
  round2YourDefender: string | null;
  round2OpponentDefender: string | null;
  round2Pairings: PairingRecord[] | null;  // 2 pairings
  
  // Final
  finalPairing: PairingRecord | null;      // auto-computed
}

// Hook persists to localStorage on every state change.
// On mount, restores from localStorage if available.
// Provides computed properties:
//   - availablePlayers (filters based on who's already paired)
//   - availableOpponents (same)
//   - currentRecommendation (navigates the decision tree based on current state)
//   - runningTotal (sum of predicted scores so far)
```

**Key principle:** The `availablePlayers` and `availableOpponents` computed properties are derived from the wizard state. As pairings are recorded, those players are removed from future dropdowns. The recommendation is looked up from the pre-computed decision tree based on the captain's actual selections, not the recommended ones.

### 5.5 API Client

**src/api/client.ts:**
```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const api = {
  createTournament: async (data: CreateTournamentPayload) => {
    const res = await fetch(`${API_BASE_URL}/tournaments`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  
  submitPredictions: async (code: string, playerName: string, roundNumber: number, predictions: Record<string, number>) => {
    const res = await fetch(`${API_BASE_URL}/sessions/${code}/predictions`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        player_name: playerName,
        round_number: roundNumber,
        predictions
      })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  
  optimize: async (roundId: number): Promise<OptimizationResult> => {
    const res = await fetch(`${API_BASE_URL}/rounds/${roundId}/optimize`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  
  saveCompletedPairings: async (roundId: number, payload: CompletedPairingsPayload) => {
    const res = await fetch(`${API_BASE_URL}/rounds/${roundId}/completed-pairings`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  
  // ... more methods for tournaments, opponent teams, rounds
};
```

### 5.6 Styling

**Design System:**
- Dark theme: Background gradient (#1a1a2e → #16213e)
- Primary accent: #e94560 (red/pink)
- Text: Light gray (#a8b2d1)
- Success: #2ecc71 (green)
- Warning: #f39c12 (orange)
- Danger: #e74c3c (red)

Implemented via Tailwind CSS with custom theme configuration.

---

## 6. Deployment

### 6.1 Frontend (Vercel)

**Configuration:**

`vercel.json`:
```json
{
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/dist",
  "framework": "vite",
  "rewrites": [
    {"source": "/(.*)", "destination": "/index.html"}
  ]
}
```

**Environment Variables:**
```
VITE_API_URL=https://strategium-backend.onrender.com/api/v1
```

**Deployment:**
- Auto-deploy on push to main
- Preview deployments for PRs

**Cost:** Free forever

---

### 6.2 Backend (Render)

**⚠️ Starter Plan Required ($7/month) for optimizer**

Start on free tier during CRUD development. Upgrade to Starter when you begin testing the optimizer endpoint.

| | Free Tier | Starter ($7/month) |
|---|---|---|
| Cold start | 30s after 15min idle | Always-on |
| Request timeout | 30s | 5 min |
| RAM | 512MB | 512MB |
| **Good for** | CRUD development | Optimizer + production |

**Configuration:**

`render.yaml`:
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
        value: postgresql://user:pass@ep-xxxxx.neon.tech/strategium?sslmode=require
      - key: CORS_ORIGINS
        value: https://strategium.vercel.app,http://localhost:5173
```

**requirements.txt:**
```
fastapi==0.109.0
uvicorn==0.27.0
sqlalchemy==2.0.25
pydantic==2.5.3
psycopg2-binary==2.9.9
python-multipart==0.0.6
```

---

### 6.3 Database (Neon)

**Setup:**
1. Create account at neon.tech
2. Create project "Strategium"
3. Create database "strategium"
4. Get connection string from dashboard

**Connection String:**
```
postgresql://user:password@ep-xxxxx.neon.tech/strategium?sslmode=require
```

**Cost:** Free forever (3GB storage)

---

### 6.4 Cost Breakdown

**Development (free tier Render):**
```
Frontend:  $0/month (Vercel free)
Backend:   $0/month (Render free — CRUD only, no optimizer)
Database:  $0/month (Neon free)
Total:     $0/month
```

**Production (Render Starter — activate when optimizer is ready):**
```
Frontend:  $0/month (Vercel free)
Backend:   $7/month (Render Starter, always-on)
Database:  $0/month (Neon free)
Total:     $7/month
```

---

## 7. Development Workflow

### 7.1 Local Setup

**GitHub Codespaces:**

Terminal 1 - Backend:
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Terminal 2 - Frontend:
```bash
cd frontend
npm install
npm run dev
```

**Environment Files:**

`frontend/.env.development.local`:
```
VITE_API_URL=https://[codespaces-url]-8000.app.github.dev/api/v1
```

`backend/.env`:
```
DATABASE_URL=postgresql://user:pass@ep-xxxxx.neon.tech/strategium?sslmode=require
CORS_ORIGINS=http://localhost:5173
```

**IMPORTANT:** Port 8000 must be set to PUBLIC visibility in Codespaces to avoid CORS issues.

### 7.2 Git Workflow

```bash
# Feature branch
git checkout -b feature/pairings-wizard
# Make changes
git add .
git commit -m "Add pairings wizard"
git push origin feature/pairings-wizard
# Create PR on GitHub
# After approval, merge to main
# Auto-deploys to Vercel + Render
```

### 7.3 Testing

**Backend:**
```bash
cd backend
pytest tests/ -v --cov
```

**Frontend:**
```bash
cd frontend
npm test
```

**Integration:**
- Test full flow: create → predict → optimize → wizard → save pairings
- Verify predicted scores match predictions
- Check wizard state persistence (refresh mid-wizard)
- Test wizard with non-recommended selections (captain deviations)

---

## 8. Security

### 8.1 Threat Model

| Threat | Mitigation |
|--------|------------|
| SQL Injection | SQLAlchemy parameterized queries |
| XSS | React automatic escaping |
| CSRF | No cookies, no state-changing GETs |
| Session guessing | 6-char codes (2.1B combinations) |
| DDoS | Render rate limiting |
| Data breach | HTTPS only, no sensitive data |
| Invalid predictions | Backend validates player_name against roster |

### 8.2 Session Codes

**Generation:**
```python
import random
import string

def generate_code() -> str:
    """Generate 6-character code (36^6 = 2.1B combinations)"""
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.SystemRandom().choices(chars, k=6))
```

**Properties:**
- Cryptographically random
- Case-insensitive (stored uppercase)
- ~1 in 2 billion collision probability
- No expiration (lasts until tournament deleted)

### 8.3 Data Privacy

**Collected Data:**
- Player names (required, locked at creation)
- Email addresses (optional)
- Predictions (tournament-specific)

**No Collection:**
- Passwords
- Payment info
- Personal identifiers beyond names

---

## 9. Performance

### 9.1 Targets

| Metric | Target | How to Achieve |
|--------|--------|----------------|
| API response (p95) | <500ms | Indexed queries, connection pooling |
| Frontend load | <2s | Code splitting, Vercel CDN |
| Optimization | <10s | Efficient algorithm, memoization |
| Tree pruning (frontend) | <10ms | In-memory lookup, no computation |
| Database query | <100ms | Proper indexes, query optimization |

### 9.2 Optimization Response Size

The decision tree JSON is estimated at:
- Round 1: 5 defenders × 5 opponent responses × 6 attacker options = 150 entries
- Round 2 lookup: ~100 unique states × 3 defenders × 3 opponents × 1 attacker option = ~900 entries
- Estimated total JSON size: **50-200KB** (well within acceptable API response size)

---

## 10. Testing Strategy

### 10.1 Backend Tests

```python
# test_api.py
def test_create_tournament(client):
    response = client.post("/api/v1/tournaments", json={
        "name": "Test",
        "num_rounds": 3,
        "team": {
            "name": "Test Team",
            "players": [
                {"name": "A", "faction": "F1"},
                {"name": "B", "faction": "F2"},
                {"name": "C", "faction": "F3"},
                {"name": "D", "faction": "F4"},
                {"name": "E", "faction": "F5"}
            ]
        }
    })
    assert response.status_code == 201
    assert response.json()["session"]["code"]
    assert len(response.json()["session"]["rounds"]) == 3

def test_prediction_validates_player_name(client, tournament):
    """Player name must match one of the 5 created players."""
    response = client.post(f"/api/v1/sessions/{tournament.session.code}/predictions", json={
        "player_name": "NotARealPlayer",
        "round_number": 1,
        "predictions": {"Opp1": 10, "Opp2": 10, "Opp3": 10, "Opp4": 10, "Opp5": 10}
    })
    assert response.status_code == 400

# test_optimizer.py
def test_optimizer_deterministic():
    result1 = optimize(players, opponents, predictions)
    result2 = optimize(players, opponents, predictions)
    assert result1 == result2

def test_optimizer_performance():
    import time
    start = time.time()
    result = optimize(players, opponents, predictions)
    duration = time.time() - start
    assert duration < 10  # Must complete in <10s

def test_optimizer_maximin():
    """Recommended defender should maximize worst-case score."""
    result = optimize(players, opponents, predictions)
    recommended = next(d for d in result["round_1"]["defender_options"] if d["is_recommended"])
    for other in result["round_1"]["defender_options"]:
        assert recommended["worst_case_total"] >= other["worst_case_total"]
```

### 10.2 Frontend Tests

```typescript
// PairingWizard.test.tsx
test('dropdowns filter to available players only', () => {
  // After Round 1 pairs Alice and Bob, Step 5 dropdown
  // should only show Carol, Dave, Eve
});

test('wizard state persists across refresh', () => {
  // Set wizard to Step 3, refresh page, verify Step 3 state restored
});

test('deviation from recommendation updates scores', () => {
  // Select non-recommended defender, verify predicted scores update
});
```

---

## 11. Implementation Checklist

### Phase 1: Frontend Foundation (build with mock data)
- [ ] Set up GitHub repo with Vite + React + TypeScript + Tailwind
- [ ] Create HomePage, TournamentCreate, TournamentDashboard
- [ ] Create PlayerView with prediction row input
- [ ] Create RoundDetail with assembled prediction matrix
- [ ] Create PairingWizard with 8 steps, mock decision tree
- [ ] Implement useWizardState hook with localStorage persistence
- [ ] Implement player eligibility filtering in wizard dropdowns
- [ ] Test wizard flow end-to-end with mock data

### Phase 2: Backend Core
- [ ] Set up FastAPI scaffold
- [ ] Define SQLAlchemy models (7 tables)
- [ ] Create database migration
- [ ] Implement tournament CRUD endpoints
- [ ] Implement session code generation
- [ ] Implement prediction submission (with player name validation)
- [ ] Implement prediction retrieval
- [ ] Connect frontend to real API

### Phase 3: Optimizer (critical path)
- [ ] Design game tree data structures
- [ ] Implement Round 1 enumeration
- [ ] Implement Round 2 enumeration with memoization
- [ ] Implement maximin scoring
- [ ] Build decision tree output matching TypeScript interface
- [ ] Verify correctness against hand-calculated examples
- [ ] Performance test (<10s target)
- [ ] Upgrade Render to Starter plan
- [ ] Connect wizard to real optimizer output

### Phase 4: Integration & Deployment
- [ ] Deploy frontend to Vercel
- [ ] Deploy backend to Render (Starter plan)
- [ ] Configure Neon database
- [ ] Set environment variables
- [ ] End-to-end production testing
- [ ] Test wizard with real optimizer output
- [ ] Test captain deviation scenarios

---

**Document Version:** 2.0 (Greenfield - Revised)  
**Last Updated:** March 2026  
**Status:** Ready to Build
