import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "")

# Ensure SSL for Neon connections
if DATABASE_URL and "neon.tech" in DATABASE_URL:
    if "sslmode" not in DATABASE_URL:
        DATABASE_URL += "?sslmode=require"

# When no DATABASE_URL is set (e.g. running without a database), use a
# SQLite in-memory fallback so the server can still start and serve the
# health-check endpoint. CRUD endpoints will fail gracefully at runtime.
if not DATABASE_URL:
    DATABASE_URL = "sqlite:///./strategium_dev.db"
    connect_args = {"check_same_thread": False}
else:
    connect_args = {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
    pool_recycle=3600,
    # pool_size and max_overflow are not supported by SQLite
    **({} if DATABASE_URL.startswith("sqlite") else {"pool_size": 5, "max_overflow": 10}),
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
