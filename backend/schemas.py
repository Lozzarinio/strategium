"""
Pydantic v2 schemas for all request and response bodies.

Naming convention:
  - <Resource>Create  — request body for POST (creation)
  - <Resource>Update  — request body for PUT (partial update)
  - <Resource>Out     — response body (always includes id, timestamps)
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


# ── Players ───────────────────────────────────────────────────────────────────


class PlayerCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    faction: Optional[str] = Field(None, max_length=255)
    email: Optional[str] = Field(None, max_length=255)


class PlayerOut(BaseModel):
    id: int
    name: str
    faction: Optional[str]
    email: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Teams ─────────────────────────────────────────────────────────────────────


class TeamCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    players: List[PlayerCreate] = Field(..., min_length=5, max_length=5)


class TeamOut(BaseModel):
    id: int
    name: str
    players: List[PlayerOut]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Opponent Players ──────────────────────────────────────────────────────────


class OpponentPlayerCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    faction: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = None


class OpponentPlayerOut(BaseModel):
    id: int
    name: str
    faction: Optional[str]
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Opponent Teams ────────────────────────────────────────────────────────────


class OpponentTeamCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    players: List[OpponentPlayerCreate] = Field(..., min_length=5, max_length=5)


class OpponentTeamUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    players: Optional[List[OpponentPlayerCreate]] = Field(None, min_length=5, max_length=5)


class OpponentTeamOut(BaseModel):
    id: int
    name: str
    players: List[OpponentPlayerOut]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Rounds ────────────────────────────────────────────────────────────────────


class RoundOut(BaseModel):
    id: int
    round_number: int
    opponent_team_id: Optional[int]
    predictions: Dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


class RoundUpdate(BaseModel):
    """Used to assign an opponent team to a round."""
    opponent_team_id: Optional[int] = None


# ── Sessions ──────────────────────────────────────────────────────────────────


class SessionOut(BaseModel):
    id: int
    code: str
    rounds: List[RoundOut]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Tournaments ───────────────────────────────────────────────────────────────


class TournamentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    num_rounds: int = Field(..., ge=1, le=5)
    team: TeamCreate


class TournamentOut(BaseModel):
    id: int
    name: str
    team: TeamOut
    session: SessionOut
    opponent_teams: List[OpponentTeamOut]
    created_at: datetime

    model_config = {"from_attributes": True}


class TournamentListItem(BaseModel):
    """Lightweight summary used for GET /tournaments list."""
    id: int
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Predictions ───────────────────────────────────────────────────────────────


class PredictionSubmit(BaseModel):
    """
    POST /api/v1/sessions/{code}/predictions

    player_name must match one of the 5 roster names (validated in endpoint).
    Each score is 0–20, integers or half-points (0.5 steps).
    """
    player_name: str = Field(..., min_length=1, max_length=255)
    round_number: int = Field(..., ge=1, le=5)
    predictions: Dict[str, float]

    @field_validator("predictions")
    @classmethod
    def validate_scores(cls, v: Dict[str, float]) -> Dict[str, float]:
        for opponent, score in v.items():
            if not (0 <= score <= 20):
                raise ValueError(f"Score for {opponent} must be between 0 and 20")
            if round(score * 2) != score * 2:
                raise ValueError(
                    f"Score for {opponent} must be an integer or half-point (e.g. 12 or 12.5)"
                )
        return v


class PredictionsOut(BaseModel):
    """GET /api/v1/rounds/{round_id}/predictions"""
    predictions: Dict[str, Dict[str, float]]
    complete: bool
    missing_players: List[str]


# ── Optimization ──────────────────────────────────────────────────────────────


class AttackerOptionOut(BaseModel):
    attackers: List[str]         # exactly 2 names
    is_recommended: bool
    worst_case_total: float
    best_case_total: float


class DefenderOptionOut(BaseModel):
    player: str
    is_recommended: bool
    worst_case_total: float
    best_case_total: float
    opponent_responses: Dict[str, List[AttackerOptionOut]]


class Round1TreeOut(BaseModel):
    defender_options: List[DefenderOptionOut]


class Round2TreeOut(BaseModel):
    defender_options: List[DefenderOptionOut]


class OptimizationMetadataOut(BaseModel):
    total_scenarios: int
    computation_time_ms: int
    prediction_hash: str


class OptimizationResultOut(BaseModel):
    """
    Response body for POST /api/v1/rounds/{round_id}/optimize.

    Matches the TypeScript OptimizationResult interface in frontend/src/types/optimization.ts.
    The frontend stores this in React state + localStorage during the wizard.
    """
    round_1: Round1TreeOut
    round_2_lookup: Dict[str, Round2TreeOut]
    metadata: OptimizationMetadataOut


# ── Completed Pairings ────────────────────────────────────────────────────────


class PairingRecord(BaseModel):
    your_player: str
    opponent_player: str
    predicted_score: float


class CompletedPairingsCreate(BaseModel):
    """POST /api/v1/rounds/{round_id}/completed-pairings"""
    pairings: List[PairingRecord] = Field(..., min_length=5, max_length=5)
    total_predicted_score: float
    optimization_best_score: Optional[float] = None


class CompletedPairingsOut(BaseModel):
    id: int
    round_id: int
    pairings: List[PairingRecord]
    total_predicted_score: float
    optimization_best_score: Optional[float]
    completed_at: datetime

    model_config = {"from_attributes": True}


# ── Health ────────────────────────────────────────────────────────────────────


class HealthOut(BaseModel):
    status: str
