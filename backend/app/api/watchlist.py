from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.models import Watchlist
from app.schemas.watchlist import WatchlistCreate, WatchlistOut
from app.core.deps import get_db, get_current_user
from app.db.models import User
from app.services.market_data import get_prices

router = APIRouter(prefix="/api/v1/watchlist", tags=["watchlist"])

@router.get("/", response_model=list[WatchlistOut])
def list_watchlist(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return db.query(Watchlist).filter_by(user_id=user.id).all()

@router.post("/", response_model=WatchlistOut, status_code=status.HTTP_201_CREATED)
def add_watchlist(
    item: WatchlistCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    symbol = item.symbol.upper().strip()

    existing = db.query(Watchlist).filter_by(user_id=user.id, symbol=symbol).first()
    if existing:
        raise HTTPException(status_code=400, detail="Symbol already in watchlist")

    try:
        _ = get_prices(db, symbol, "1mo", "1d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Unknown symbol")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Data provider error: {e}")

    w = Watchlist(user_id=user.id, symbol=symbol)
    db.add(w)
    db.commit()
    db.refresh(w)
    return w

@router.delete("/{watchlist_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_watchlist(
    watchlist_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    w = db.query(Watchlist).filter_by(id=watchlist_id, user_id=user.id).first()
    if not w:
        raise HTTPException(status_code=404, detail="Item not found")

    db.delete(w)
    db.commit()
    return
