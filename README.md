FinDash
=======

FinDash is a full-stack finance dashboard built with **React (Vite + TypeScript)** and **FastAPI (Python)**.  
It provides secure user authentication, persistent personal watchlists, interactive price charts with technical indicators,
auto-refreshing market snapshots, and a simple machine learning advisor for trading insights.  

Deployed live: https://fin-dash-seven.vercel.app  

-------------------------------------------------

Features
--------

**Authentication:**
- User registration, login, and logout
- Secure password hashing (bcrypt with salted hashes)
- HTTP-only, secure cookies for sessions
- Session persistence across reloads
- Environment-aware cookie policy (SameSite=Lax in dev, SameSite=None + Secure in prod)

**Watchlist:**
- Add or remove stock symbols
- Prevents duplicates (server-side validation)
- Persistent selection of the last viewed symbol
- Empty state onboarding message (“Add AAPL to get started”)
- Auto-refreshing snapshots with latest price and percentage change (every 30s)
- Friendly toasts for add/remove successes and errors

**Market Data & Charts:**
- Data fetched from Yahoo Finance via `yfinance`, cached in PostgreSQL
- SQLAlchemy ORM + Alembic migrations manage schema
- Candlestick charts built using **Lightweight Charts (TradingView library)**
- Technical indicators:
  - SMA20 and SMA50 overlays with toggle switches
  - RSI14 panel with guide lines at 30/70
- Configurable chart range: 1mo, 3mo, 6mo, 1y, 2y, 5y, max
- Configurable intervals: 1d, 1wk, 1mo
- Badge above chart showing last close + % change

**Machine Learning Advisor:**
- Basic ML agent computes:
  - Probability of upward movement
  - Volatility regime (low / medium / high)
  - Simple Buy / Hold / Sell recommendation
- Placeholder models can be extended for:
  - Short-term (day trading)
  - Long-term investing
- Results displayed as pills above the chart (e.g. “ML prob↑: 53.4% | Vol: 0.20 (low) | Hold”)

**User Experience Enhancements:**
- Toasts for actions and errors (add/remove/watchlist failures, login issues)
- Loading skeletons instead of plain “Loading…” text
- Responsive grid layout for watchlist + chart
- Local storage persistence for selected symbol
- Auto-resizing charts with ResizeObserver
- Polished UI with Tailwind CSS components

-------------------------------------------

Tech Stack
----------

**Frontend:**
- React 18 (Vite + TypeScript)
- Tailwind CSS for styling
- Lightweight Charts (TradingView)
- Toast + skeleton loaders built with Tailwind utilities
- Hosted on Vercel (auto-deploy from GitHub)

**Backend:**
- FastAPI (Python web framework)
- SQLAlchemy ORM
- Alembic migrations for schema changes
- PostgreSQL (NeonDB in production, SQLite optional in dev)
- bcrypt for password hashing
- JWT-based access tokens stored in secure cookies
- yfinance for market data
- Hosted on Render (auto-deploy from GitHub via render.yaml)

**Database:**
- PostgreSQL table schema managed with Alembic
- Tables:
  - users (id, email, password_hash)
  - watchlist (id, user_id, symbol)
  - prices (id, symbol, ts, open, high, low, close, volume [BIGINT])
- Constraints:
  - Unique email constraint on users
  - Unique (symbol, ts) constraint on prices
- Migration example: `alembic revision --autogenerate -m "Change volume to BigInteger"`

-----------------------------------------------------------------------------------------

Getting Started (Development)
-----------------------------

1. Clone the repository:
    git clone https://github.com/your-username/fin-dash.git
    cd fin-dash

2. Backend setup:
    cd backend
    python -m venv venv
    source venv/bin/activate   (or venv\Scripts\activate on Windows)
    pip install -r requirements.txt
    alembic upgrade head
    uvicorn app.main:app –reload

    Environment variables in `backend/.env`:
        DATABASE_URL=your_postgres_url
        SECRET_KEY=your_secret_key
        ENV=dev

3. Frontend setup:
    cd frontend
    npm install
    npm run dev

    Environment variables in `frontend/.env`:
        VITE_API_URL=http://localhost:8000
    
4. Open the frontend in your browser:
http://localhost:5173

----------------------

Deployment
----------

**Backend:**
- Hosted on Render (free web service plan)
- Connected to GitHub with `render.yaml`
- Auto-deploys on push to `main`
- Runs with `ENV=prod` for secure cookies

**Frontend:**
- Hosted on Vercel
- Connected to GitHub (auto-deploys from main branch)
- Configured with `VITE_API_URL` pointing to Render backend

**Database:**
- Neon PostgreSQL (serverless, free tier)
- Handles schema migrations from Alembic
- Uses BIGINT for volume to avoid overflow

--------------------------

Future Improvements
-------------------

- More advanced ML agents tuned separately for short-term vs long-term horizons
- Extended symbol search with live provider integration (beyond static S&P 100 list)
- Portfolio tracking with PnL, allocations, and charts
- Additional technical indicators (MACD, Bollinger Bands, etc.)
- Email verification and password reset flows
- News sentiment analysis
- User preferences saved server-side (indicator toggles, chart defaults)
