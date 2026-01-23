from sqlalchemy import Column, Integer, String, Float, ForeignKey, JSON, create_engine
from sqlalchemy.ext.mutable import MutableDict
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker

Base = declarative_base()

class Tournament(Base):
    __tablename__ = "tournaments"
    
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    teams = relationship("Team", back_populates="tournament")

class Team(Base):
    __tablename__ = "teams"
    
    id = Column(Integer, primary_key=True)
    tournament_id = Column(Integer, ForeignKey("tournaments.id"))
    name = Column(String, nullable=False)
    players = relationship("Player", back_populates="team")
    tournament = relationship("Tournament", back_populates="teams")

class Player(Base):
    __tablename__ = "players"
    
    id = Column(Integer, primary_key=True)
    team_id = Column(Integer, ForeignKey("teams.id"))
    name = Column(String, nullable=False)
    army = Column(String)
    archetype = Column(String)
    team = relationship("Team", back_populates="players")

class Session(Base):
    __tablename__ = "sessions"
    
    id = Column(Integer, primary_key=True)
    code = Column(String, unique=True, nullable=False, index=True)
    tournament_id = Column(Integer, ForeignKey("tournaments.id"))
    your_team_id = Column(Integer, ForeignKey("teams.id"))
    opponent_team_id = Column(Integer, ForeignKey("teams.id"))
    round_number = Column(Integer)
    round_name = Column(String)
    matrices = Column(MutableDict.as_mutable(JSON), default={})  # Stores player predictions
    
class OptimizationResult(Base):
    __tablename__ = "optimization_results"
    
    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    results = Column(JSON)  # Stores the full optimization output

# Database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./strategium.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
