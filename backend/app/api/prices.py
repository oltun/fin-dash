from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Literal

from app.core.deps import get_db, get_current_user
from app.services.market_data import get_prices

router = APIRouter(prefix="/api/v1/prices", tags=["prices"])

@router.get("/")
def prices(
    symbol: str = Query(..., min_length=1),
    range: Literal["1mo","3mo","6mo","1y","2y","5y","max"] = "1y",
    interval: Literal["1d","1wk","1mo"] = "1d",
    db: Session = Depends(get_db),
    _user = Depends(get_current_user),
):
    try:
        data = get_prices(db, symbol, range, interval)
        return data
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
