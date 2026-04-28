"""
Strategium — FastAPI application.

All CRUD endpoints are implemented here. The optimizer endpoint returns a
mock result built from actual predictions; the real algorithm is Phase 3.

Run locally:
    cd backend
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import hashlib
import json
import os
import random
import string
import time
from itertools import combinations
from typing import Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import models
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


# ── Optimizer (mock) ──────────────────────────────────────────────────────────

@app.post(
    "/api/v1/rounds/{round_id}/optimize",
    response_model=schemas.OptimizationResultOut,
    tags=["Optimization"],
    summary="Run optimizer — returns mock result (Phase 3 will use real algorithm)",
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

    return _build_optimization_result(your_players, opp_players, preds)


# ── Optimizer helper (mock maximin tree) ──────────────────────────────────────

def _score(your: str, opp: str, predictions: dict) -> float:
    return float(predictions.get(your, {}).get(opp, 10.0))


def _build_r2_defender_options(
    your3: list[str],
    opp3: list[str],
    predictions: dict,
) -> list[dict]:
    """
    For a given set of 3 remaining players per side (Round 2),
    enumerate all (your_def, opp_def) pairs and compute attacker options.

    Round 2 games:
      - your_def  vs  opp_atk_X  (opp picks which of their 2 attackers)
      - your_chosen_atk  vs  opp_def  (you pick which of your 2 attackers)
      - your_other_atk  vs  opp_other_atk  (automatic)

    For each of your 2 "attacker options" (which of your 2 faces opp_def),
    opp has 2 choices (which of their 2 faces your defender).
    This gives 2×2 = 4 game paths, giving worst_case = min, best_case = max.
    """
    def_options = []

    for your_def in your3:
        your_atks = [p for p in your3 if p != your_def]  # exactly 2
        opp_responses: dict[str, list[dict]] = {}
        def_worst = float("inf")
        def_best = float("-inf")

        for opp_def in opp3:
            opp_atks = [p for p in opp3 if p != opp_def]  # exactly 2
            atk_options = []

            # You pick which of your 2 attackers faces opp_def
            for i in range(2):
                chosen_atk = your_atks[i]
                other_atk = your_atks[1 - i]

                # Opp picks which of their 2 attackers faces your_def
                path_scores = []
                for j in range(2):
                    opp_facing_def = opp_atks[j]
                    opp_other = opp_atks[1 - j]
                    total = (
                        _score(your_def, opp_facing_def, predictions)   # game A
                        + _score(chosen_atk, opp_def, predictions)      # game B
                        + _score(other_atk, opp_other, predictions)     # game C
                    )
                    path_scores.append(total)

                atk_options.append({
                    "attackers": [chosen_atk, other_atk],
                    "is_recommended": False,
                    "worst_case_total": round(min(path_scores), 1),
                    "best_case_total": round(max(path_scores), 1),
                })

            # Maximin: recommend the attacker option with highest worst-case
            atk_options.sort(key=lambda x: x["worst_case_total"], reverse=True)
            atk_options[0]["is_recommended"] = True

            best = atk_options[0]
            def_worst = min(def_worst, best["worst_case_total"])
            def_best = max(def_best, best["best_case_total"])
            opp_responses[opp_def] = atk_options

        def_options.append({
            "player": your_def,
            "is_recommended": False,
            "worst_case_total": round(def_worst, 1),
            "best_case_total": round(def_best, 1),
            "opponent_responses": opp_responses,
        })

    # Maximin: recommend the defender with highest worst-case
    def_options.sort(key=lambda x: x["worst_case_total"], reverse=True)
    def_options[0]["is_recommended"] = True
    return def_options


def _build_optimization_result(
    your_players: list[str],
    opp_players: list[str],
    predictions: dict,
) -> dict:
    """
    Build a complete OptimizationResult matching the TypeScript interface.

    Round 2 lookup: all C(5,3) × C(5,3) = 100 combinations, fully computed.
    Round 1 tree: for each (your_def, opp_def) pair, evaluate C(4,2)=6
    attacker options using R1 scores + R2 lookahead.
    """
    t_start = time.time()

    # ── Round 2 lookup (100 entries) ─────────────────────────────────────────
    round_2_lookup: dict[str, dict] = {}

    for your3 in combinations(your_players, 3):
        for opp3 in combinations(opp_players, 3):
            your3_list = list(your3)
            opp3_list = list(opp3)
            key = f"{','.join(sorted(your3_list))}|{','.join(sorted(opp3_list))}"
            def_options = _build_r2_defender_options(your3_list, opp3_list, predictions)
            round_2_lookup[key] = {"defender_options": def_options}

    # ── Round 1 tree ──────────────────────────────────────────────────────────
    r1_options = []

    for your_def in your_players:
        your_rem4 = [p for p in your_players if p != your_def]
        opp_responses: dict[str, list[dict]] = {}
        def_worst = float("inf")
        def_best = float("-inf")

        for opp_def in opp_players:
            opp_rem4 = [p for p in opp_players if p != opp_def]
            atk_options = []

            for a1, a2 in combinations(your_rem4, 2):
                # a1 is sent to face opp_def; a2 stays in R2 pool
                your_r2 = [p for p in your_players if p not in (your_def, a1)]  # 3 players

                worst = float("inf")
                best = float("-inf")

                # Opp picks one of their 4 non-defenders to face your_def
                for opp_atk in opp_rem4:
                    opp_r2 = [p for p in opp_rem4 if p != opp_atk]  # 3 players
                    r2_key = f"{','.join(sorted(your_r2))}|{','.join(sorted(opp_r2))}"
                    r2_tree = round_2_lookup.get(r2_key)

                    r1_score = (
                        _score(your_def, opp_atk, predictions)
                        + _score(a1, opp_def, predictions)
                    )

                    if r2_tree and r2_tree["defender_options"]:
                        # You play optimally in R2 (pick the best defender)
                        r2_best_worst = max(
                            opt["worst_case_total"] for opt in r2_tree["defender_options"]
                        )
                        r2_best_best = max(
                            opt["best_case_total"] for opt in r2_tree["defender_options"]
                        )
                    else:
                        r2_best_worst = r2_best_best = 30.0

                    # Opp picks the opp_atk that hurts you most
                    worst = min(worst, r1_score + r2_best_worst)
                    best = max(best, r1_score + r2_best_best)

                atk_options.append({
                    "attackers": [a1, a2],
                    "is_recommended": False,
                    "worst_case_total": round(worst, 1),
                    "best_case_total": round(best, 1),
                })

            # Maximin: recommend attacker pair with highest worst-case
            atk_options.sort(key=lambda x: x["worst_case_total"], reverse=True)
            atk_options[0]["is_recommended"] = True

            best_atk = atk_options[0]
            def_worst = min(def_worst, best_atk["worst_case_total"])
            def_best = max(def_best, best_atk["best_case_total"])
            opp_responses[opp_def] = atk_options

        r1_options.append({
            "player": your_def,
            "is_recommended": False,
            "worst_case_total": round(def_worst, 1),
            "best_case_total": round(def_best, 1),
            "opponent_responses": opp_responses,
        })

    # Maximin: recommend the defender with highest worst-case
    r1_options.sort(key=lambda x: x["worst_case_total"], reverse=True)
    r1_options[0]["is_recommended"] = True

    elapsed_ms = int((time.time() - t_start) * 1000)
    pred_hash = hashlib.md5(
        json.dumps(predictions, sort_keys=True).encode()
    ).hexdigest()[:8]

    return {
        "round_1": {"defender_options": r1_options},
        "round_2_lookup": round_2_lookup,
        "metadata": {
            "total_scenarios": 129600,
            "computation_time_ms": elapsed_ms,
            "prediction_hash": pred_hash,
        },
    }
