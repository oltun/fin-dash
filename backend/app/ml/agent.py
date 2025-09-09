from __future__ import annotations
import numpy as np
import pandas as pd
from typing import Literal, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
import yfinance as yf
from datetime import timezone
from app.db.models import Price

Mode = Literal["day", "swing", "long"]

def _load_ohlc(db: Session, symbol: str) -> pd.DataFrame:
    rows = (
        db.query(Price)
        .filter(Price.symbol == symbol.upper())
        .order_by(Price.ts.asc())
        .all()
    )
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(
        [{"ts": r.ts, "open": r.open, "high": r.high, "low": r.low, "close": r.close, "volume": r.volume}
         for r in rows]
    ).set_index("ts")
    df.index = pd.to_datetime(df.index, utc=True)
    return df

def _fetch_provider_full(symbol: str) -> pd.DataFrame:
    """Fetch full daily history from Yahoo."""
    t = yf.Ticker(symbol)
    hist = t.history(period="max", interval="1d", auto_adjust=False, actions=False)
    if hist is None or hist.empty:
        return pd.DataFrame()
    hist = hist.rename(columns=str.lower)
    idx = pd.DatetimeIndex(hist.index)
    if idx.tz is None:
        hist.index = pd.to_datetime(idx, utc=True)
    else:
        hist.index = idx.tz_convert("UTC")
    return hist

def _upsert_prices(db: Session, symbol: string, df: pd.DataFrame) -> None:
    """Bulk insert with ON CONFLICT DO NOTHING; chunk to avoid huge statements."""
    sym = symbol.upper()
    if df is None or df.empty:
        return

    rows = []
    for ts, row in df.iterrows():
        rows.append({
            "symbol": sym,
            "ts": ts.to_pydatetime(),
            "open": float(row.get("open")) if pd.notna(row.get("open")) else None,
            "high": float(row.get("high")) if pd.notna(row.get("high")) else None,
            "low": float(row.get("low")) if pd.notna(row.get("low")) else None,
            "close": float(row.get("close")) if pd.notna(row.get("close")) else None,
            "volume": int(row.get("volume")) if pd.notna(row.get("volume")) else None,
        })

    tbl = Price.__table__
    CHUNK = 1000
    for i in range(0, len(rows), CHUNK):
        chunk = rows[i:i+CHUNK]
        stmt = insert(tbl).values(chunk)
        stmt = stmt.on_conflict_do_nothing(index_elements=["symbol", "ts"])
        db.execute(stmt)

    db.commit()

def _ensure_history(db: Session, symbol: str, min_rows: int) -> pd.DataFrame:
    """
    Ensure we have at least min_rows of daily bars in DB.
    If not, fetch full from provider and upsert, then reload.
    """
    df = _load_ohlc(db, symbol)
    if len(df) >= min_rows:
        return df
    prov = _fetch_provider_full(symbol)
    if prov.empty:
        return df
    _upsert_prices(db, symbol, prov)
    return _load_ohlc(db, symbol)

def _ann_vol(returns: pd.Series, window: int = 20) -> pd.Series:
    return returns.rolling(window).std() * np.sqrt(252)

def _regime_from_vol(value: float, series: pd.Series) -> str:
    q33, q66 = series.quantile(0.33), series.quantile(0.66)
    return "low" if value <= q33 else ("medium" if value <= q66 else "high")

def _rec_from_prob(prob: float, vol_regime: str, buy=0.58, sell=0.42) -> str:
    if vol_regime == "high":
        buy += 0.02
        sell -= 0.02
    if prob >= buy:
        return "Consider Buy"
    if prob <= sell:
        return "Consider Sell"
    return "Hold"

def _final_payload(symbol: str, prob_up: float, vol: float, vol_series: pd.Series, features: Dict[str, float]) -> Dict[str, Any]:
    regime = _regime_from_vol(vol, vol_series)
    rec = _rec_from_prob(prob_up, regime)
    return {
        "symbol": symbol.upper(),
        "prob_up": round(float(prob_up), 4),
        "volatility": round(float(vol), 4),
        "regime": regime,
        "recommendation": rec,
        "features": {k: float(v) for k, v in features.items()},
    }

def _rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    up = delta.clip(lower=0)
    down = -1 * delta.clip(upper=0)
    roll_up = up.ewm(alpha=1/period, adjust=False).mean()
    roll_down = down.ewm(alpha=1/period, adjust=False).mean()
    rs = roll_up / (roll_down.replace(0, 1e-12))
    return 100 - (100 / (1 + rs))

def score_day(db: Session, symbol: str) -> Dict[str, Any]:
    """
    Short horizon: next-day direction using short-term momentum & RSI.
    """
    df = _ensure_history(db, symbol, min_rows=200)
    if df.empty or len(df) < 200:
        raise ValueError("Not enough data for day model")

    d = df.copy()
    d["ret1"]  = d["close"].pct_change(1)
    d["ret3"]  = d["close"].pct_change(3)
    d["ret5"]  = d["close"].pct_change(5)
    d["rsi14"] = _rsi(d["close"], 14)
    d["sma5"]  = d["close"].rolling(5).mean()
    d["sma10"] = d["close"].rolling(10).mean()
    d["sma5_rel"]  = d["close"] / d["sma5"]  - 1.0
    d["sma10_rel"] = d["close"] / d["sma10"] - 1.0
    d["vol20"] = _ann_vol(d["close"].pct_change(), 20)
    d["y"] = (d["close"].shift(-1) > d["close"]).astype(int)
    d = d.dropna()
    if len(d) < 180:
        raise ValueError("Not enough data for day model")

    feats = ["ret1","ret3","ret5","rsi14","sma5_rel","sma10_rel","vol20"]
    X = d[feats].values
    y = d["y"].values
    model = LogisticRegression(max_iter=300)
    model.fit(X[:-1], y[:-1])
    prob_up = model.predict_proba(X[-1:])[:,1][0]
    vol_now = d["vol20"].iloc[-1]
    return _final_payload(symbol, prob_up, vol_now, d["vol20"], {k: d[k].iloc[-1] for k in feats})

def score_swing(db: Session, symbol: str) -> Dict[str, Any]:
    """
    Medium horizon: 1–4 weeks. Smoother momentum/MA features.
    """
    df = _ensure_history(db, symbol, min_rows=260)
    if df.empty or len(df) < 220:
        raise ValueError("Not enough data for swing model")

    d = df.copy()
    d["ret5"]   = d["close"].pct_change(5)
    d["ret10"]  = d["close"].pct_change(10)
    d["ret20"]  = d["close"].pct_change(20)
    d["rsi14"]  = _rsi(d["close"], 14)
    d["sma20"]  = d["close"].rolling(20).mean()
    d["sma50"]  = d["close"].rolling(50).mean()
    d["sma20_rel"] = d["close"] / d["sma20"] - 1.0
    d["sma50_rel"] = d["close"] / d["sma50"] - 1.0
    d["vol20"] = _ann_vol(d["close"].pct_change(), 20)
    d["y"] = (d["close"].shift(-5) > d["close"]).astype(int)
    d = d.dropna()
    if len(d) < 200:
        raise ValueError("Not enough data for swing model")

    feats = ["ret5","ret10","ret20","rsi14","sma20_rel","sma50_rel","vol20"]
    X = d[feats].values
    y = d["y"].values
    model = LogisticRegression(max_iter=300)
    model.fit(X[:-1], y[:-1])
    prob_up = model.predict_proba(X[-1:])[:,1][0]
    vol_now = d["vol20"].iloc[-1]
    return _final_payload(symbol, prob_up, vol_now, d["vol20"], {k: d[k].iloc[-1] for k in feats})

def score_long(db: Session, symbol: str) -> Dict[str, Any]:
    """
    Long horizon: months. Trend & drawdown stats; nonlinear model.
    """
    df = _ensure_history(db, symbol, min_rows=520)
    if df.empty or len(df) < 300:
        raise ValueError("Not enough data for long model")

    d = df.copy()
    r = d["close"].pct_change()
    d["ret20"]  = d["close"].pct_change(20)
    d["ret60"]  = d["close"].pct_change(60)
    d["ret120"] = d["close"].pct_change(120)
    d["vol60"]  = _ann_vol(r, 60)
    d["sma50"]  = d["close"].rolling(50).mean()
    d["sma200"] = d["close"].rolling(200).mean()
    d["sma50_rel"]  = d["close"] / d["sma50"]  - 1.0
    d["sma200_rel"] = d["close"] / d["sma200"] - 1.0
    roll_max = d["close"].rolling(200, min_periods=1).max()
    d["drawdown"] = d["close"] / roll_max - 1.0
    d["y"] = (d["close"].shift(-60) > d["close"]).astype(int)
    d = d.dropna()
    if len(d) < 280:
        raise ValueError("Not enough data for long model")

    feats = ["ret20","ret60","ret120","vol60","sma50_rel","sma200_rel","drawdown"]
    X = d[feats].values
    y = d["y"].values
    model = RandomForestClassifier(
        n_estimators=200, max_depth=6, min_samples_leaf=10, random_state=42
    )
    model.fit(X[:-1], y[:-1])
    prob_up = model.predict_proba(X[-1:])[:,1][0]
    vol_now = d["vol60"].iloc[-1]
    return _final_payload(symbol, prob_up, vol_now, d["vol60"], {k: d[k].iloc[-1] for k in feats})
