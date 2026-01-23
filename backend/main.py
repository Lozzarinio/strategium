from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import random
import string
from typing import List

from models import get_db, init_db, Tournament, Team, Player, Session as DBSession
from schemas import (
    TournamentCreate, TournamentResponse,
    TeamCreate, TeamResponse,
    SessionCreate, SessionResponse,
    MatrixInput,
    RecommendationRequest
)
from optimizer import PairingOptimizer, OptimizationResult as OptimizerResult

app = FastAPI(title="Strategium API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    init_db()

def generate_session_code() -> str:
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

@app.get("/")
async def root():
    return {"message": "Strategium API is running"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.post("/tournaments", response_model=TournamentResponse)
async def create_tournament(tournament: TournamentCreate, db: Session = Depends(get_db)):
    db_tournament = Tournament(name=tournament.name)
    db.add(db_tournament)
    db.flush()
    
    for team_data in tournament.teams:
        db_team = Team(
            tournament_id=db_tournament.id,
            name=team_data.name
        )
        db.add(db_team)
        db.flush()
        
        for player_data in team_data.players:
            db_player = Player(
                team_id=db_team.id,
                name=player_data.name,
                army=player_data.army,
                archetype=player_data.archetype
            )
            db.add(db_player)
    
    db.commit()
    db.refresh(db_tournament)
    return db_tournament

@app.get("/tournaments", response_model=List[TournamentResponse])
async def list_tournaments(db: Session = Depends(get_db)):
    return db.query(Tournament).all()

@app.get("/tournaments/{tournament_id}", response_model=TournamentResponse)
async def get_tournament(tournament_id: int, db: Session = Depends(get_db)):
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    return tournament

@app.get("/tournaments/{tournament_id}/sessions")
async def list_tournament_sessions(tournament_id: int, db: Session = Depends(get_db)):
    """List all sessions for a tournament"""
    sessions = db.query(DBSession).filter(DBSession.tournament_id == tournament_id).all()
    return sessions

@app.post("/sessions", response_model=SessionResponse)
async def create_session(session_data: SessionCreate, db: Session = Depends(get_db)):
    code = generate_session_code()
    while db.query(DBSession).filter(DBSession.code == code).first():
        code = generate_session_code()
    
    db_session = DBSession(
        code=code,
        tournament_id=session_data.tournament_id,
        your_team_id=session_data.your_team_id,
        opponent_team_id=session_data.opponent_team_id,
        round_number=session_data.round_number,
        round_name=session_data.round_name,
        matrices={}
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session

@app.get("/sessions/{code}", response_model=SessionResponse)
async def get_session(code: str, db: Session = Depends(get_db)):
    session = db.query(DBSession).filter(DBSession.code == code).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session

@app.post("/sessions/{code}/matrix")
async def submit_matrix(code: str, matrix_data: MatrixInput, db: Session = Depends(get_db)):
    session = db.query(DBSession).filter(DBSession.code == code).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    current_matrices = session.matrices if session.matrices else {}
    current_matrices[matrix_data.player_name] = matrix_data.matrix
    session.matrices = current_matrices
    db.commit()
    db.refresh(session)
    
    return {
        "message": "Matrix submitted", 
        "player": matrix_data.player_name,
        "total_submitted": len(session.matrices)
    }

@app.get("/sessions/{code}/matrices")
async def get_matrices(code: str, db: Session = Depends(get_db)):
    session = db.query(DBSession).filter(DBSession.code == code).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {
        "session_code": code,
        "matrices": session.matrices or {},
        "submitted_count": len(session.matrices or {})
    }

@app.post("/sessions/{code}/optimize")
async def optimize_pairings(code: str, db: Session = Depends(get_db)):
    session = db.query(DBSession).filter(DBSession.code == code).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    your_team = db.query(Team).filter(Team.id == session.your_team_id).first()
    opponent_team = db.query(Team).filter(Team.id == session.opponent_team_id).first()
    
    if not your_team or not opponent_team:
        raise HTTPException(status_code=404, detail="Teams not found")
    
    your_player_names = [p.name for p in your_team.players]
    submitted_players = list(session.matrices.keys()) if session.matrices else []
    
    if len(submitted_players) < len(your_player_names):
        return {
            "error": "Not all players have submitted matrices",
            "submitted": submitted_players,
            "required": your_player_names,
            "missing": [p for p in your_player_names if p not in submitted_players]
        }
    
    opponent_player_names = [p.name for p in opponent_team.players]
    optimizer = PairingOptimizer(
        your_team=your_player_names,
        opponent_team=opponent_player_names,
        matrices=session.matrices
    )
    
    result = optimizer.optimize(num_simulations=10000)
    
    return {
        "best_defender": result.best_defender,
        "best_attackers": result.best_attackers,
        "expected_score": round(result.expected_score, 2),
        "best_case_score": round(result.best_case_score, 2),
        "worst_case_score": round(result.worst_case_score, 2),
        "decision_tree": result.decision_tree,
        "simulations_run": result.simulations_run,
        "computation_time": round(result.computation_time, 2)
    }

@app.post("/sessions/{code}/recommend")
async def get_recommendation(
    code: str, 
    request: RecommendationRequest, 
    db: Session = Depends(get_db)
):
    session = db.query(DBSession).filter(DBSession.code == code).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if not session.matrices:
        raise HTTPException(status_code=400, detail="No matrices submitted")
    
    from itertools import combinations
    
    if request.decision_type == "pick_defender":
        best_defender = None
        best_avg_score = 0
        defender_results = {}
        
        for potential_defender in request.unpaired_your_team:
            simulation_scores = []
            
            for _ in range(500):
                total_score = 0
                your_remaining = request.unpaired_your_team.copy()
                opp_remaining = request.unpaired_opponent_team.copy()
                
                while len(your_remaining) > 0:
                    if len(your_remaining) == len(request.unpaired_your_team):
                        your_def = potential_defender
                    else:
                        your_def = random.choice(your_remaining)
                    
                    opp_def = random.choice(opp_remaining)
                    your_remaining.remove(your_def)
                    opp_remaining.remove(opp_def)
                    
                    if len(your_remaining) == 0:
                        break
                    
                    your_attackers = random.sample(your_remaining, min(2, len(your_remaining)))
                    opp_attackers = random.sample(opp_remaining, min(2, len(opp_remaining)))
                    
                    your_chosen_attacker = random.choice(your_attackers)
                    opp_chosen_attacker = random.choice(opp_attackers)
                    
                    if your_chosen_attacker in session.matrices:
                        total_score += session.matrices[your_chosen_attacker].get(opp_def, 10)
                    
                    if your_def in session.matrices:
                        total_score += session.matrices[your_def].get(opp_chosen_attacker, 10)
                    
                    your_remaining.remove(your_chosen_attacker)
                    opp_remaining.remove(opp_chosen_attacker)
                
                simulation_scores.append(total_score)
            
            avg_score = sum(simulation_scores) / len(simulation_scores)
            defender_results[potential_defender] = round(avg_score, 2)
            
            if avg_score > best_avg_score:
                best_avg_score = avg_score
                best_defender = potential_defender
        
        return {
            "recommendation": best_defender,
            "expected_total_score": round(best_avg_score, 2),
            "all_options": defender_results,
            "decision_type": "pick_defender"
        }
    
    elif request.decision_type == "pick_attackers":
        if not request.opponent_defender:
            raise HTTPException(status_code=400, detail="opponent_defender required")
        
        if not request.your_defender:
            raise HTTPException(status_code=400, detail="your_defender required")
        
        remaining = [p for p in request.unpaired_your_team if p != request.your_defender]
        
        best_attackers = None
        best_avg_score = 0
        attacker_results = {}
        
        for attacker_pair in combinations(remaining, min(2, len(remaining))):
            simulation_scores = []
            
            for _ in range(500):
                total_score = 0
                
                opp_remaining = [p for p in request.unpaired_opponent_team if p != request.opponent_defender]
                opp_attackers = random.sample(opp_remaining, min(2, len(opp_remaining)))
                
                your_chosen = random.choice(list(attacker_pair))
                opp_chosen = random.choice(opp_attackers)
                
                if your_chosen in session.matrices:
                    total_score += session.matrices[your_chosen].get(request.opponent_defender, 10)
                
                if request.your_defender in session.matrices:
                    total_score += session.matrices[request.your_defender].get(opp_chosen, 10)
                
                your_remaining = [p for p in request.unpaired_your_team 
                                 if p not in [request.your_defender, your_chosen]]
                opp_remaining_after = [p for p in request.unpaired_opponent_team 
                                      if p not in [request.opponent_defender, opp_chosen]]
                
                while len(your_remaining) > 1:
                    your_def = random.choice(your_remaining)
                    opp_def = random.choice(opp_remaining_after)
                    
                    your_remaining.remove(your_def)
                    opp_remaining_after.remove(opp_def)
                    
                    your_atts = random.sample(your_remaining, min(2, len(your_remaining)))
                    opp_atts = random.sample(opp_remaining_after, min(2, len(opp_remaining_after)))
                    
                    your_ch = random.choice(your_atts)
                    opp_ch = random.choice(opp_atts)
                    
                    if your_ch in session.matrices:
                        total_score += session.matrices[your_ch].get(opp_def, 10)
                    if your_def in session.matrices:
                        total_score += session.matrices[your_def].get(opp_ch, 10)
                    
                    your_remaining.remove(your_ch)
                    opp_remaining_after.remove(opp_ch)
                
                if len(your_remaining) == 1 and len(opp_remaining_after) == 1:
                    if your_remaining[0] in session.matrices:
                        total_score += session.matrices[your_remaining[0]].get(opp_remaining_after[0], 10)
                
                simulation_scores.append(total_score)
            
            avg_score = sum(simulation_scores) / len(simulation_scores)
            attacker_results[str(attacker_pair)] = round(avg_score, 2)
            
            if avg_score > best_avg_score:
                best_avg_score = avg_score
                best_attackers = list(attacker_pair)
        
        return {
            "recommendation": best_attackers,
            "expected_total_score": round(best_avg_score, 2),
            "all_options": attacker_results,
            "decision_type": "pick_attackers"
        }
    
    elif request.decision_type == "pick_defender_matchup":
        if not request.your_defender or not request.opponent_attackers:
            raise HTTPException(status_code=400, detail="your_defender and opponent_attackers required")
        
        best_matchup = None
        best_avg_score = 0
        matchup_results = {}
        
        for opp_attacker in request.opponent_attackers:
            simulation_scores = []
            
            for _ in range(500):
                total_score = 0
                
                if request.your_defender in session.matrices:
                    total_score += session.matrices[request.your_defender].get(opp_attacker, 10)
                
                your_remaining = [p for p in request.unpaired_your_team if p != request.your_defender]
                opp_remaining = [p for p in request.unpaired_opponent_team if p != opp_attacker]
                
                while len(your_remaining) > 1:
                    your_def = random.choice(your_remaining)
                    opp_def = random.choice(opp_remaining)
                    
                    your_remaining.remove(your_def)
                    opp_remaining.remove(opp_def)
                    
                    your_atts = random.sample(your_remaining, min(2, len(your_remaining)))
                    opp_atts = random.sample(opp_remaining, min(2, len(opp_remaining)))
                    
                    your_ch = random.choice(your_atts)
                    opp_ch = random.choice(opp_atts)
                    
                    if your_ch in session.matrices:
                        total_score += session.matrices[your_ch].get(opp_def, 10)
                    if your_def in session.matrices:
                        total_score += session.matrices[your_def].get(opp_ch, 10)
                    
                    your_remaining.remove(your_ch)
                    opp_remaining.remove(opp_ch)
                
                if len(your_remaining) == 1 and len(opp_remaining) == 1:
                    if your_remaining[0] in session.matrices:
                        total_score += session.matrices[your_remaining[0]].get(opp_remaining[0], 10)
                
                simulation_scores.append(total_score)
            
            avg_score = sum(simulation_scores) / len(simulation_scores)
            matchup_results[opp_attacker] = round(avg_score, 2)
            
            if avg_score > best_avg_score:
                best_avg_score = avg_score
                best_matchup = opp_attacker
        
        return {
            "recommendation": best_matchup,
            "expected_total_score": round(best_avg_score, 2),
            "all_options": matchup_results,
            "decision_type": "pick_defender_matchup"
        }