const BASE = import.meta.env.VITE_API_URL;

async function jsonFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });

  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.detail) {
        msg = Array.isArray(body.detail)
          ? body.detail.map((d: any) => d.msg ?? d).join(", ")
          : body.detail;
      }
    } catch {
      const text = await res.text().catch(() => "");
      if (text) msg += `: ${text}`;
    }
    throw new Error(msg);
  }

  return res.json() as Promise<T>;
}

export type User = { id: number; email: string };

export function getHealth() {
  return jsonFetch<{ status: string; time: string }>("/api/v1/health");
}

export function registerUser(email: string, password: string) {
  return jsonFetch<User>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function loginUser(email: string, password: string) {
  return jsonFetch<{ message: string }>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function fetchMe() {
  return jsonFetch<User>("/api/v1/auth/me");
}

export async function logoutUser() {
  const res = await fetch(`${BASE}/api/v1/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Logout failed");
}

export type WatchlistItem = { id: number; symbol: string };

export function getWatchlist() {
  return jsonFetch<WatchlistItem[]>("/api/v1/watchlist/");
}

export function addWatchlistSymbol(symbol: string) {
  return jsonFetch<WatchlistItem>("/api/v1/watchlist/", {
    method: "POST",
    body: JSON.stringify({ symbol }),
  });
}

export function deleteWatchlistItem(id: number) {
  return fetch(`${BASE}/api/v1/watchlist/${id}`, {
    method: "DELETE",
    credentials: "include",
  }).then((res) => {
    if (!res.ok) throw new Error("Failed to delete");
  });
}

export type PricesResponse = {
  source: "provider" | "db";
  symbol: string;
  candles: {
    t: string;
    o: number;
    h: number;
    l: number;
    c: number;
    v?: number | null;
  }[];
  indicators: {
    sma20: (number | null)[];
    sma50: (number | null)[];
    rsi14: (number | null)[];
  };
};

export function getPrices(symbol: string, range = "1y", interval = "1d") {
  return jsonFetch<PricesResponse>(
    `/api/v1/prices?symbol=${encodeURIComponent(symbol)}&range=${range}&interval=${interval}`
  );
}

export type SnapshotMap = Record<string, { last: number; prev: number | null; pct: number | null } | null>;

export function getSnapshots(symbols: string[]) {
  const q = symbols.join(",");
  return jsonFetch<SnapshotMap>(`/api/v1/prices/snapshots?symbols=${encodeURIComponent(q)}`);
}

export type AgentScore = {
    symbol: string;
    prob_up: number;
    volatility: number;
    regime: "low" | "medium" | "high" | string;
    recommendation: string;
    features: Record<string, number>;
  };
  
  export function getAgentScore(symbol: string, mode: "day" | "swing" | "long" = "swing") {
    const q = new URLSearchParams({ symbol, mode });
    return jsonFetch<AgentScore>(`/api/v1/agent/score?${q.toString()}`);
  }
