from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.api import auth, watchlist, prices, snapshots, agent
from app.db.session import SessionLocal, engine
from app.db.models import User

app = FastAPI(title="FinDash API", version="0.1.0")

origins = [
    "http://localhost:5173",
    "https://YOUR-VERCEL-APP.vercel.app",
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
