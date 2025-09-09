from __future__ import annotations
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from typing import Literal
import socket
socket.setdefaulttimeout(8)

from app.db.models import Price

def sma(series: pd.Series, window: int) -> pd.Series:
    return series.rolling(window=window, min_periods=window).mean()

def rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    up = delta.clip(lower=0)
    down = -1 * delta.clip(upper=0)
    roll_up = up.ewm(alpha=1/period, adjust=False).mean()
    roll_down = down.ewm(alpha=1/period, adjust=False).mean()
    rs = roll_up / (roll_down.replace(0, 1e-12))
    return 100 - (100 / (1 + rs))

def _range_to_start(range_: str) -> datetime:
    now = datetime.now(timezone.utc)
    table = {
        "1mo": now - timedelta(days=31),
        "3mo": now - timedelta(days=93),
        "6mo": now - timedelta(days=186),
        "1y":  now - timedelta(days=372),
        "2y":  now - timedelta(days=744),
        "5y":  now - timedelta(days=1860),
        "max": datetime(1980, 1, 1, tzinfo=timezone.utc),
    }
    return table.get(range_, now - timedelta(days=372))

def get_prices(
    db: Session,
    symbol: str,
    range_: Literal["1mo","3mo","6mo","1y","2y","5y","max"] = "1y",
    interval: Literal["1d","1wk","1mo"] = "1d",
):
    sym = symbol.upper().strip()
    start = _range_to_start(range_)

    use_cache = (interval == "1d")
    cached = []
    if use_cache:
        cached = (
            db.query(Price)
            .filter(Price.symbol == sym, Price.ts >= start)
            .order_by(Price.ts.asc())
            .all()
        )
        if cached:
            earliest_ts = cached[0].ts
            if earliest_ts <= (start + timedelta(days=2)):
                df = pd.DataFrame(
                    [
                        {
                            "ts": r.ts,
                            "open": r.open,
                            "high": r.high,
                            "low": r.low,
                            "close": r.close,
                            "volume": r.volume,
                        }
                        for r in cached
                    ]
                )
                df.set_index(pd.to_datetime(df["ts"], utc=True), inplace=True)
                return {"source": "db", **_with_indicators(sym, df)}

    ticker = yf.Ticker(sym)
    try:
        hist = ticker.history(period=range_, interval=interval, auto_adjust=False, actions=False)
    except Exception as e:
        raise ValueError(f"Provider unavailable: {e}")

    if hist is None or hist.empty:
        raise ValueError("Unknown or unsupported symbol")

    hist = hist.rename(columns=str.lower)
    idx = pd.DatetimeIndex(hist.index)
    if idx.tz is None:
        hist.index = pd.to_datetime(idx, utc=True)
    else:
        hist.index = idx.tz_convert("UTC")

    if interval == "1d":
        to_insert = []
        for ts, row in hist.iterrows():
            to_insert.append(
                Price(
                    symbol=sym,
                    ts=ts.to_pydatetime(),
                    open=float(row.get("open", None)),
                    high=float(row.get("high", None)),
                    low=float(row.get("low", None)),
                    close=float(row.get("close", None)),
                    volume=int(row.get("volume", 0)) if pd.notna(row.get("volume", None)) else None,
                )
            )
        if to_insert:
            for r in to_insert:
                exists = db.query(Price).filter(Price.symbol == sym, Price.ts == r.ts).first()
                if not exists:
                    db.add(r)
            db.commit()

    return {"source": "provider", **_with_indicators(sym, hist)}

def _with_indicators(sym: str, df: pd.DataFrame):
    if df.empty:
        return {"symbol": sym, "candles": [], "indicators": {"sma20": [], "sma50": [], "rsi14": []}}
    out = []
    for ts, row in df.iterrows():
        out.append({
            "t": ts.date().isoformat(),
            "o": float(row["open"]),
            "h": float(row["high"]),
            "l": float(row["low"]),
            "c": float(row["close"]),
            "v": int(row["volume"]) if pd.notna(row.get("volume")) else None,
        })
    closes = df["close"].astype(float)
    sma20 = sma(closes, 20).round(4).tolist()
    sma50 = sma(closes, 50).round(4).tolist()
    rsi14 = rsi(closes, 14).round(4).tolist()
    return {
        "symbol": sym,
        "candles": out,
        "indicators": {
            "sma20": [v if pd.notna(v) else None for v in sma20],
            "sma50": [v if pd.notna(v) else None for v in sma50],
            "rsi14": [v if pd.notna(v) else None for v in rsi14],
        },
    }
