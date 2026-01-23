from pydantic import BaseModel, Field
from typing import List, Dict, Optional

class PlayerCreate(BaseModel):
    name: str
    army: Optional[str] = None
    archetype: Optional[str] = None

class PlayerResponse(BaseModel):
    id: int
    name: str
    army: Optional[str]
    archetype: Optional[str]
    
    class Config:
        from_attributes = True

class TeamCreate(BaseModel):
    name: str
    players: List[PlayerCreate]

class TeamResponse(BaseModel):
    id: int
    name: str
    players: List[PlayerResponse]
    
    class Config:
        from_attributes = True

class TournamentCreate(BaseModel):
    name: str
    teams: List[TeamCreate]

class TournamentResponse(BaseModel):
    id: int
    name: str
    teams: List[TeamResponse]
    
    class Config:
        from_attributes = True

class SessionCreate(BaseModel):
    tournament_id: int
    your_team_id: int
    opponent_team_id: int
    round_number: int = 1
    round_name: Optional[str] = "Round 1"

class SessionResponse(BaseModel):
    id: int
    code: str
    tournament_id: int
    your_team_id: int
    opponent_team_id: int
    round_number: int
    round_name: Optional[str]
    
    class Config:
        from_attributes = True

class MatrixInput(BaseModel):
    player_name: str
    matrix: Dict[str, float] = Field(
        ..., 
        description="Dict mapping opponent names to predicted scores (0-20)"
    )

from typing import Literal

class RecommendationRequest(BaseModel):
    decision_type: Literal["pick_defender", "pick_attackers", "pick_defender_matchup"]
    unpaired_your_team: List[str]
    unpaired_opponent_team: List[str]
    opponent_defender: Optional[str] = None
    opponent_attackers: Optional[List[str]] = None
    your_defender: Optional[str] = None