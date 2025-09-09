from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict
from app.core.deps import get_db, get_current_user
from app.db.models import Price, User

router = APIRouter(prefix="/api/v1/prices", tags=["prices"])

@router.get("/snapshots")
def snapshots(
    symbols: str = Query(..., description="Comma-separated symbols"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    out: Dict[str, dict] = {}
    for raw in symbols.split(","):
        sym = raw.upper().strip()
        rows = (
            db.query(Price)
            .filter(Price.symbol == sym)
            .order_by(Price.ts.desc())
            .limit(2)
            .all()
        )
        if not rows:
            out[sym] = None
            continue
        last = float(rows[0].close)
        prev = float(rows[1].close) if len(rows) > 1 else None
        pct = None
        if prev and prev != 0:
            pct = (last - prev) / prev * 100.0
        out[sym] = {"last": last, "prev": prev, "pct": pct}
    return out
