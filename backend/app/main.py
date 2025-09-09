import os
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.api import auth, watchlist, prices, snapshots, agent
from app.db.session import SessionLocal, engine
from app.db.models import User
from app.core.security import SECRET_KEY, ACCESS_TOKEN_EXPIRE_MINUTES

app = FastAPI(title="FinDash API", version="0.1.0")

origins = [
    "http://localhost:5173",
    "https://fin-dash-seven.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/v1/health")
def health():
    """Simple health check endpoint"""
    return {"status": "ok", "time": datetime.now(timezone.utc).isoformat()}

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/api/v1/db/health")
def db_health(db: Session = Depends(get_db)):
    """Quick DB connectivity check"""
    count = db.query(User).count()
    return {"ok": True, "users": count}

@app.on_event("startup")
def _discard_cached_plans():
    with engine.begin() as conn:
        try:
            conn.exec_driver_sql("DISCARD ALL;")
        except Exception:
            pass

app.include_router(auth.router)
app.include_router(watchlist.router)
app.include_router(prices.router)
app.include_router(snapshots.router)
app.include_router(agent.router)

print(f"[startup] ENV={os.getenv('ENV')}, SECRET_KEY set={bool(SECRET_KEY)}, len={len(SECRET_KEY) if SECRET_KEY else 0}, EXP_MIN={ACCESS_TOKEN_EXPIRE_MINUTES}")
