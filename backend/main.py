"""
Strategium — FastAPI application entry point.

This file contains:
  - App factory and CORS middleware
  - Health check endpoint
  - Router mounts (endpoints to be implemented in Phase 2/3)

Run locally:
    uvicorn main:app --reload --host 0.0.0.0 --port 8000

Docs available at:
    http://localhost:8000/docs
    http://localhost:8000/redoc
"""

from __future__ import annotations

import os

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from database import Base, engine
from schemas import HealthOut

load_dotenv()

# ── App factory ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="Strategium API",
    description=(
        "Backend API for the Strategium Warhammer 40K team tournament pairing optimizer. "
        "See GREENFIELD_REQUIREMENTS_v3.md and GREENFIELD_ARCHITECTURE_v2.md for full spec."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────

_raw_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173")
CORS_ORIGINS: list[str] = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Database tables ───────────────────────────────────────────────────────────
# Create all tables on startup (safe no-op if they already exist).
# In production with Neon/PostgreSQL, prefer Alembic migrations instead.

@app.on_event("startup")
def create_tables() -> None:
    Base.metadata.create_all(bind=engine)


# ── Health check ──────────────────────────────────────────────────────────────

@app.get(
    "/api/v1/health",
    response_model=HealthOut,
    tags=["Health"],
    summary="Health check",
)
def health() -> HealthOut:
    """Returns {"status": "ok"} — used by load balancers and smoke tests."""
    return HealthOut(status="ok")


# ── Placeholder route groups (to be implemented in Phase 2) ──────────────────
# These are documented stubs so the /docs page shows the planned API surface.
# Each will be replaced with a real APIRouter in Phase 2.

@app.post(
    "/api/v1/tournaments",
    status_code=201,
    tags=["Tournaments"],
    summary="Create tournament (Phase 2)",
    include_in_schema=True,
)
def create_tournament_stub() -> dict:
    return {"detail": "Not yet implemented — Phase 2"}


@app.get(
    "/api/v1/tournaments",
    tags=["Tournaments"],
    summary="List tournaments (Phase 2)",
    include_in_schema=True,
)
def list_tournaments_stub() -> dict:
    return {"detail": "Not yet implemented — Phase 2"}


@app.get(
    "/api/v1/tournaments/{tournament_id}",
    tags=["Tournaments"],
    summary="Get tournament (Phase 2)",
    include_in_schema=True,
)
def get_tournament_stub(tournament_id: int) -> dict:
    return {"detail": "Not yet implemented — Phase 2"}


@app.delete(
    "/api/v1/tournaments/{tournament_id}",
    status_code=204,
    tags=["Tournaments"],
    summary="Delete tournament (Phase 2)",
    include_in_schema=True,
)
def delete_tournament_stub(tournament_id: int) -> Response:
    return Response(status_code=204)


@app.get(
    "/api/v1/sessions/{code}",
    tags=["Sessions"],
    summary="Get session by code (Phase 2)",
    include_in_schema=True,
)
def get_session_stub(code: str) -> dict:
    return {"detail": "Not yet implemented — Phase 2"}


@app.post(
    "/api/v1/sessions/{code}/predictions",
    tags=["Predictions"],
    summary="Submit player predictions (Phase 2)",
    include_in_schema=True,
)
def submit_predictions_stub(code: str) -> dict:
    return {"detail": "Not yet implemented — Phase 2"}


@app.get(
    "/api/v1/rounds/{round_id}/predictions",
    tags=["Predictions"],
    summary="Get round predictions (Phase 2)",
    include_in_schema=True,
)
def get_predictions_stub(round_id: int) -> dict:
    return {"detail": "Not yet implemented — Phase 2"}


@app.get(
    "/api/v1/rounds/{round_id}",
    tags=["Rounds"],
    summary="Get round (Phase 2)",
    include_in_schema=True,
)
def get_round_stub(round_id: int) -> dict:
    return {"detail": "Not yet implemented — Phase 2"}


@app.put(
    "/api/v1/rounds/{round_id}",
    tags=["Rounds"],
    summary="Update round (assign opponent team) (Phase 2)",
    include_in_schema=True,
)
def update_round_stub(round_id: int) -> dict:
    return {"detail": "Not yet implemented — Phase 2"}


@app.post(
    "/api/v1/tournaments/{tournament_id}/opponent-teams",
    status_code=201,
    tags=["Opponent Teams"],
    summary="Add opponent team (Phase 2)",
    include_in_schema=True,
)
def create_opponent_team_stub(tournament_id: int) -> dict:
    return {"detail": "Not yet implemented — Phase 2"}


@app.get(
    "/api/v1/tournaments/{tournament_id}/opponent-teams",
    tags=["Opponent Teams"],
    summary="List opponent teams (Phase 2)",
    include_in_schema=True,
)
def list_opponent_teams_stub(tournament_id: int) -> dict:
    return {"detail": "Not yet implemented — Phase 2"}


@app.get(
    "/api/v1/opponent-teams/{team_id}",
    tags=["Opponent Teams"],
    summary="Get opponent team (Phase 2)",
    include_in_schema=True,
)
def get_opponent_team_stub(team_id: int) -> dict:
    return {"detail": "Not yet implemented — Phase 2"}


@app.put(
    "/api/v1/opponent-teams/{team_id}",
    tags=["Opponent Teams"],
    summary="Update opponent team (Phase 2)",
    include_in_schema=True,
)
def update_opponent_team_stub(team_id: int) -> dict:
    return {"detail": "Not yet implemented — Phase 2"}


@app.delete(
    "/api/v1/opponent-teams/{team_id}",
    status_code=204,
    tags=["Opponent Teams"],
    summary="Delete opponent team (Phase 2)",
    include_in_schema=True,
)
def delete_opponent_team_stub(team_id: int) -> Response:
    return Response(status_code=204)


@app.post(
    "/api/v1/rounds/{round_id}/optimize",
    tags=["Optimization"],
    summary="Run optimizer (Phase 3)",
    include_in_schema=True,
)
def optimize_stub(round_id: int) -> dict:
    return {"detail": "Not yet implemented — Phase 3"}


@app.post(
    "/api/v1/rounds/{round_id}/completed-pairings",
    status_code=201,
    tags=["Completed Pairings"],
    summary="Save completed pairings (Phase 2)",
    include_in_schema=True,
)
def create_completed_pairings_stub(round_id: int) -> dict:
    return {"detail": "Not yet implemented — Phase 2"}


@app.get(
    "/api/v1/rounds/{round_id}/completed-pairings",
    tags=["Completed Pairings"],
    summary="Get completed pairings (Phase 2)",
    include_in_schema=True,
)
def get_completed_pairings_stub(round_id: int) -> dict:
    return {"detail": "Not yet implemented — Phase 2"}
