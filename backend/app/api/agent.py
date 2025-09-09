from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Literal
from app.core.deps import get_db, get_current_user
from app.db.models import User
from app.ml.agent import score_day, score_swing, score_long

router = APIRouter(prefix="/api/v1/agent", tags=["agent"])

@router.get("/score")
def score(
    symbol: str = Query(..., min_length=1),
    mode: Literal["day","swing","long"] = Query("swing"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        if mode == "day":
            return score_day(db, symbol)
        elif mode == "long":
            return score_long(db, symbol)
        return score_swing(db, symbol)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
