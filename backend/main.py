"""
Strategium — FastAPI application.

Run locally:
    cd backend
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import os
import random
import string
from typing import Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import models
import optimizer as _optimizer
import schemas
from database import Base, engine, get_db

load_dotenv()

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Strategium API",
    description=(
        "Backend for the Strategium Warhammer 40K team tournament pairing optimizer."
    ),
    version="1.0.0",
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


# ── Startup ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
def create_tables() -> None:
    Base.metadata.create_all(bind=engine)
    print(f"[CORS] allow_origins = {CORS_ORIGINS}")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _generate_session_code(db: Session) -> str:
    """Generate a unique 6-character uppercase+digit session code."""
    chars = string.ascii_uppercase + string.digits
    for _ in range(20):  # retry on collision (astronomically unlikely)
        code = "".join(random.SystemRandom().choices(chars, k=6))
        if not db.query(models.Session).filter_by(code=code).first():
            return code
    raise RuntimeError("Failed to generate unique session code after 20 attempts")


def _get_tournament_or_404(tournament_id: int, db: Session) -> models.Tournament:
    t = db.query(models.Tournament).filter_by(id=tournament_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")
    return t


def _get_round_or_404(round_id: int, db: Session) -> models.Round:
    r = db.query(models.Round).filter_by(id=round_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Round not found")
    return r


def _get_opponent_team_or_404(team_id: int, db: Session) -> models.OpponentTeam:
    ot = db.query(models.OpponentTeam).filter_by(id=team_id).first()
    if not ot:
        raise HTTPException(status_code=404, detail="Opponent team not found")
    return ot


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/api/v1/health", response_model=schemas.HealthOut, tags=["Health"])
def health() -> schemas.HealthOut:
    return schemas.HealthOut(status="ok")


# ── Tournaments ───────────────────────────────────────────────────────────────

@app.post(
    "/api/v1/tournaments",
    status_code=201,
    response_model=schemas.TournamentOut,
    tags=["Tournaments"],
    summary="Create tournament with team, session, and rounds",
)
def create_tournament(
    payload: schemas.TournamentCreate,
    db: Session = Depends(get_db),
) -> models.Tournament:
    code = _generate_session_code(db)

    # All writes in one transaction
    tournament = models.Tournament(name=payload.name)
    db.add(tournament)
    db.flush()

    team = models.Team(tournament_id=tournament.id, name=payload.team.name)
    db.add(team)
    db.flush()

    for p in payload.team.players:
        db.add(models.Player(
            team_id=team.id,
            name=p.name,
            faction=p.faction,
            email=p.email,
        ))

    session = models.Session(tournament_id=tournament.id, code=code)
    db.add(session)
    db.flush()

    for i in range(1, payload.num_rounds + 1):
        db.add(models.Round(
            session_id=session.id,
            round_number=i,
            predictions={},
        ))

    db.commit()
    db.refresh(tournament)
    return tournament


@app.get(
    "/api/v1/tournaments",
    response_model=list[schemas.TournamentListItem],
    tags=["Tournaments"],
    summary="List all tournaments",
)
def list_tournaments(db: Session = Depends(get_db)) -> list[models.Tournament]:
    return db.query(models.Tournament).order_by(models.Tournament.id.desc()).all()


@app.get(
    "/api/v1/tournaments/{tournament_id}",
    response_model=schemas.TournamentOut,
    tags=["Tournaments"],
    summary="Get tournament with team, session, and opponent teams",
)
def get_tournament(
    tournament_id: int,
    db: Session = Depends(get_db),
) -> models.Tournament:
    return _get_tournament_or_404(tournament_id, db)


@app.delete(
    "/api/v1/tournaments/{tournament_id}",
    status_code=204,
    tags=["Tournaments"],
    summary="Delete tournament (cascades to all child records)",
)
def delete_tournament(
    tournament_id: int,
    db: Session = Depends(get_db),
) -> Response:
    tournament = _get_tournament_or_404(tournament_id, db)
    db.delete(tournament)
    db.commit()
    return Response(status_code=204)


# ── Sessions ──────────────────────────────────────────────────────────────────

@app.get(
    "/api/v1/sessions/{code}",
    response_model=schemas.SessionDetailOut,
    tags=["Sessions"],
    summary="Look up session by 6-character code",
)
def get_session(code: str, db: Session = Depends(get_db)) -> dict:
    session = db.query(models.Session).filter_by(code=code.upper()).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    tournament = session.tournament
    team = tournament.team

    # Build rounds with opponent_team details
    rounds_out = []
    for r in sorted(session.rounds, key=lambda x: x.round_number):
        rounds_out.append(schemas.RoundDetailOut(
            id=r.id,
            round_number=r.round_number,
            opponent_team_id=r.opponent_team_id,
            predictions=r.predictions or {},
            created_at=r.created_at,
            opponent_team=(
                schemas.OpponentTeamOut.model_validate(r.opponent_team)
                if r.opponent_team else None
            ),
        ))

    return schemas.SessionDetailOut(
        id=session.id,
        code=session.code,
        tournament_id=tournament.id,
        tournament_name=tournament.name,
        team=schemas.TeamOut.model_validate(team),
        rounds=rounds_out,
        created_at=session.created_at,
    )


# ── Predictions ───────────────────────────────────────────────────────────────

@app.post(
    "/api/v1/sessions/{code}/predictions",
    tags=["Predictions"],
    summary="Submit one player's predictions for a round",
)
def submit_predictions(
    code: str,
    payload: schemas.PredictionSubmit,
    db: Session = Depends(get_db),
) -> dict:
    session = db.query(models.Session).filter_by(code=code.upper()).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Validate player_name against roster
    team = session.tournament.team
    roster = [p.name for p in team.players]
    if payload.player_name not in roster:
        raise HTTPException(
            status_code=400,
            detail=f"player_name '{payload.player_name}' not in roster: {roster}",
        )

    # Find the round by round_number
    round_ = next(
        (r for r in session.rounds if r.round_number == payload.round_number),
        None,
    )
    if round_ is None:
        raise HTTPException(
            status_code=404,
            detail=f"Round {payload.round_number} not found in this session",
        )

    if round_.opponent_team_id is None:
        raise HTTPException(
            status_code=400,
            detail="Round has no opponent team assigned — cannot submit predictions yet",
        )

    # Merge predictions into the round's JSON (atomic row update per player)
    current = dict(round_.predictions or {})
    current[payload.player_name] = payload.predictions
    round_.predictions = current

    # SQLAlchemy needs a flag for JSON mutation on SQLite
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(round_, "predictions")

    db.commit()

    return {"ok": True, "round_id": round_.id, "player_name": payload.player_name}


@app.get(
    "/api/v1/rounds/{round_id}/predictions",
    response_model=schemas.PredictionsOut,
    tags=["Predictions"],
    summary="Get assembled prediction matrix for a round",
)
def get_predictions(
    round_id: int,
    db: Session = Depends(get_db),
) -> schemas.PredictionsOut:
    round_ = _get_round_or_404(round_id, db)
    session = round_.session
    team = session.tournament.team
    roster = [p.name for p in team.players]

    preds: dict = round_.predictions or {}
    missing = [name for name in roster if name not in preds]

    return schemas.PredictionsOut(
        predictions=preds,
        complete=len(missing) == 0,
        missing_players=missing,
    )


# ── Opponent Teams ────────────────────────────────────────────────────────────

@app.post(
    "/api/v1/tournaments/{tournament_id}/opponent-teams",
    status_code=201,
    response_model=schemas.OpponentTeamOut,
    tags=["Opponent Teams"],
    summary="Add an opponent team with 5 players to a tournament",
)
def create_opponent_team(
    tournament_id: int,
    payload: schemas.OpponentTeamCreate,
    db: Session = Depends(get_db),
) -> models.OpponentTeam:
    _get_tournament_or_404(tournament_id, db)

    opp_team = models.OpponentTeam(tournament_id=tournament_id, name=payload.name)
    db.add(opp_team)
    db.flush()

    for p in payload.players:
        db.add(models.OpponentPlayer(
            team_id=opp_team.id,
            name=p.name,
            faction=p.faction,
            notes=p.notes,
        ))

    db.commit()
    db.refresh(opp_team)
    return opp_team


@app.get(
    "/api/v1/tournaments/{tournament_id}/opponent-teams",
    response_model=list[schemas.OpponentTeamOut],
    tags=["Opponent Teams"],
    summary="List opponent teams for a tournament",
)
def list_opponent_teams(
    tournament_id: int,
    db: Session = Depends(get_db),
) -> list[models.OpponentTeam]:
    _get_tournament_or_404(tournament_id, db)
    return (
        db.query(models.OpponentTeam)
        .filter_by(tournament_id=tournament_id)
        .order_by(models.OpponentTeam.id)
        .all()
    )


@app.get(
    "/api/v1/opponent-teams/{team_id}",
    response_model=schemas.OpponentTeamOut,
    tags=["Opponent Teams"],
    summary="Get a single opponent team with players",
)
def get_opponent_team(
    team_id: int,
    db: Session = Depends(get_db),
) -> models.OpponentTeam:
    return _get_opponent_team_or_404(team_id, db)


@app.put(
    "/api/v1/opponent-teams/{team_id}",
    response_model=schemas.OpponentTeamOut,
    tags=["Opponent Teams"],
    summary="Update opponent team name and/or replace players",
)
def update_opponent_team(
    team_id: int,
    payload: schemas.OpponentTeamUpdate,
    db: Session = Depends(get_db),
) -> models.OpponentTeam:
    opp_team = _get_opponent_team_or_404(team_id, db)

    if payload.name is not None:
        opp_team.name = payload.name

    if payload.players is not None:
        # Replace all players: delete existing, insert new
        for old_player in opp_team.players:
            db.delete(old_player)
        db.flush()

        for p in payload.players:
            db.add(models.OpponentPlayer(
                team_id=opp_team.id,
                name=p.name,
                faction=p.faction,
                notes=p.notes,
            ))

    db.commit()
    db.refresh(opp_team)
    return opp_team


@app.delete(
    "/api/v1/opponent-teams/{team_id}",
    status_code=204,
    tags=["Opponent Teams"],
    summary="Delete an opponent team and its players",
)
def delete_opponent_team(
    team_id: int,
    db: Session = Depends(get_db),
) -> Response:
    opp_team = _get_opponent_team_or_404(team_id, db)
    db.delete(opp_team)
    db.commit()
    return Response(status_code=204)


# ── Rounds ────────────────────────────────────────────────────────────────────

@app.get(
    "/api/v1/rounds/{round_id}",
    response_model=schemas.RoundDetailOut,
    tags=["Rounds"],
    summary="Get round details including assigned opponent team",
)
def get_round(
    round_id: int,
    db: Session = Depends(get_db),
) -> schemas.RoundDetailOut:
    round_ = _get_round_or_404(round_id, db)
    return schemas.RoundDetailOut(
        id=round_.id,
        round_number=round_.round_number,
        opponent_team_id=round_.opponent_team_id,
        predictions=round_.predictions or {},
        created_at=round_.created_at,
        opponent_team=(
            schemas.OpponentTeamOut.model_validate(round_.opponent_team)
            if round_.opponent_team else None
        ),
    )


@app.put(
    "/api/v1/rounds/{round_id}",
    response_model=schemas.RoundDetailOut,
    tags=["Rounds"],
    summary="Assign an opponent team to a round",
)
def update_round(
    round_id: int,
    payload: schemas.RoundUpdate,
    db: Session = Depends(get_db),
) -> schemas.RoundDetailOut:
    round_ = _get_round_or_404(round_id, db)

    if payload.opponent_team_id is not None:
        # Validate opponent team belongs to the same tournament
        session = round_.session
        opp_team = db.query(models.OpponentTeam).filter_by(
            id=payload.opponent_team_id,
            tournament_id=session.tournament_id,
        ).first()
        if not opp_team:
            raise HTTPException(
                status_code=404,
                detail="Opponent team not found in this tournament",
            )

    round_.opponent_team_id = payload.opponent_team_id
    db.commit()
    db.refresh(round_)

    return schemas.RoundDetailOut(
        id=round_.id,
        round_number=round_.round_number,
        opponent_team_id=round_.opponent_team_id,
        predictions=round_.predictions or {},
        created_at=round_.created_at,
        opponent_team=(
            schemas.OpponentTeamOut.model_validate(round_.opponent_team)
            if round_.opponent_team else None
        ),
    )


# ── Completed Pairings ────────────────────────────────────────────────────────

@app.post(
    "/api/v1/rounds/{round_id}/completed-pairings",
    status_code=201,
    response_model=schemas.CompletedPairingsOut,
    tags=["Completed Pairings"],
    summary="Save final wizard pairings for a round",
)
def create_completed_pairings(
    round_id: int,
    payload: schemas.CompletedPairingsCreate,
    db: Session = Depends(get_db),
) -> models.CompletedPairings:
    round_ = _get_round_or_404(round_id, db)

    if round_.completed_pairings is not None:
        raise HTTPException(
            status_code=409,
            detail="Completed pairings already exist for this round. Delete first to re-submit.",
        )

    cp = models.CompletedPairings(
        round_id=round_id,
        pairings=[p.model_dump() for p in payload.pairings],
        total_predicted_score=payload.total_predicted_score,
        optimization_best_score=payload.optimization_best_score,
    )
    db.add(cp)
    db.commit()
    db.refresh(cp)
    return cp


@app.get(
    "/api/v1/rounds/{round_id}/completed-pairings",
    response_model=schemas.CompletedPairingsOut,
    tags=["Completed Pairings"],
    summary="Get completed pairings for a round",
)
def get_completed_pairings(
    round_id: int,
    db: Session = Depends(get_db),
) -> models.CompletedPairings:
    round_ = _get_round_or_404(round_id, db)
    if round_.completed_pairings is None:
        raise HTTPException(status_code=404, detail="No completed pairings for this round")
    return round_.completed_pairings


# ── Optimizer ─────────────────────────────────────────────────────────────────

@app.post(
    "/api/v1/rounds/{round_id}/optimize",
    response_model=schemas.OptimizationResultOut,
    tags=["Optimization"],
    summary="Run complete game-tree optimizer (maximin, ~130k scenarios)",
)
def optimize_round(
    round_id: int,
    db: Session = Depends(get_db),
) -> dict:
    round_ = _get_round_or_404(round_id, db)

    if round_.opponent_team_id is None:
        raise HTTPException(status_code=400, detail="Round has no opponent team assigned")

    session = round_.session
    team = session.tournament.team
    your_players = [p.name for p in sorted(team.players, key=lambda x: x.id)]
    opp_players = [
        p.name for p in sorted(round_.opponent_team.players, key=lambda x: x.id)
    ]

    preds: dict = round_.predictions or {}
    missing = [name for name in your_players if name not in preds]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Predictions missing for: {missing}. All 5 players must submit before optimizing.",
        )

    return _optimizer.optimize(your_players, opp_players, preds)
