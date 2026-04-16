"""
SQLAlchemy ORM models — one class per database table.

All 8 tables from the requirements schema are defined here.
Foreign keys use ON DELETE CASCADE (or SET NULL for optional references)
to mirror the SQL schema exactly.
"""

from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Float,
    DateTime,
    ForeignKey,
    JSON,
    Index,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from database import Base


class Tournament(Base):
    __tablename__ = "tournaments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    team = relationship(
        "Team", back_populates="tournament", uselist=False, cascade="all, delete-orphan"
    )
    session = relationship(
        "Session", back_populates="tournament", uselist=False, cascade="all, delete-orphan"
    )
    opponent_teams = relationship(
        "OpponentTeam", back_populates="tournament", cascade="all, delete-orphan"
    )


class Team(Base):
    """Your team — exactly 1 per tournament."""

    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    tournament_id = Column(
        Integer, ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False
    )
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    tournament = relationship("Tournament", back_populates="team")
    players = relationship(
        "Player", back_populates="team", cascade="all, delete-orphan"
    )


class Player(Base):
    """Your team's players — exactly 5 per team. Names are locked at creation."""

    __tablename__ = "players"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(
        Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False
    )
    name = Column(String(255), nullable=False)
    faction = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    team = relationship("Team", back_populates="players")


class OpponentTeam(Base):
    """Opponent teams — reusable across rounds, N per tournament."""

    __tablename__ = "opponent_teams"

    id = Column(Integer, primary_key=True, index=True)
    tournament_id = Column(
        Integer, ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False
    )
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    tournament = relationship("Tournament", back_populates="opponent_teams")
    players = relationship(
        "OpponentPlayer", back_populates="team", cascade="all, delete-orphan"
    )
    rounds = relationship("Round", back_populates="opponent_team")


class OpponentPlayer(Base):
    """Opponent team's players — exactly 5 per opponent team."""

    __tablename__ = "opponent_players"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(
        Integer, ForeignKey("opponent_teams.id", ondelete="CASCADE"), nullable=False
    )
    name = Column(String(255), nullable=False)
    faction = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    team = relationship("OpponentTeam", back_populates="players")


class Session(Base):
    """Session with a unique 6-character code — exactly 1 per tournament."""

    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    tournament_id = Column(
        Integer, ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False
    )
    code = Column(String(6), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    tournament = relationship("Tournament", back_populates="session")
    rounds = relationship(
        "Round", back_populates="session", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("code", name="idx_sessions_code"),
    )


class Round(Base):
    """
    A single pairing round within a session.

    predictions JSON shape: {player_name: {opponent_name: score}}
    e.g. {"Alice": {"Enemy1": 15, "Enemy2": 12, ...}, "Bob": {...}}
    """

    __tablename__ = "rounds"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(
        Integer, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
    )
    round_number = Column(Integer, nullable=False)
    # ON DELETE SET NULL: deleting an opponent team doesn't delete the round
    opponent_team_id = Column(
        Integer, ForeignKey("opponent_teams.id", ondelete="SET NULL"), nullable=True
    )
    predictions = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    session = relationship("Session", back_populates="rounds")
    opponent_team = relationship("OpponentTeam", back_populates="rounds")
    completed_pairings = relationship(
        "CompletedPairings",
        back_populates="round",
        uselist=False,
        cascade="all, delete-orphan",
    )


class CompletedPairings(Base):
    """
    Final wizard output — one record per completed wizard run.

    pairings JSON shape: [{your_player, opponent_player, predicted_score}, x5]
    Written via a single POST at the end of the pairing wizard.
    """

    __tablename__ = "completed_pairings"

    id = Column(Integer, primary_key=True, index=True)
    round_id = Column(
        Integer, ForeignKey("rounds.id", ondelete="CASCADE"), nullable=False
    )
    pairings = Column(JSON, nullable=False)  # list of 5 pairing objects
    total_predicted_score = Column(Float, nullable=False)
    optimization_best_score = Column(Float, nullable=True)
    completed_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    round = relationship("Round", back_populates="completed_pairings")


# ── Explicit indexes (matching the SQL schema) ────────────────────────────────

Index("idx_teams_tournament", Team.tournament_id)
Index("idx_players_team", Player.team_id)
Index("idx_opponent_teams_tournament", OpponentTeam.tournament_id)
Index("idx_opponent_players_team", OpponentPlayer.team_id)
Index("idx_sessions_tournament", Session.tournament_id)
Index("idx_rounds_session", Round.session_id)
Index("idx_completed_pairings_round", CompletedPairings.round_id)
