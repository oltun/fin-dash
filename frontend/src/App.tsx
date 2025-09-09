import { useEffect, useState } from "react";
import AuthForm from "./components/AuthForm";
import PriceChart from "./components/PriceChart";
import SymbolSearch from "./components/SymbolSearch";
import {
  fetchMe,
  logoutUser,
  getHealth,
  getWatchlist,
  addWatchlistSymbol,
  deleteWatchlistItem,
  getPrices,
  getAgentScore,
} from "./lib/api";
import type {
  User,
  WatchlistItem,
  PricesResponse,
  AgentScore,
} from "./lib/api";

const RANGE_OPTIONS = ["1mo", "3mo", "6mo", "1y", "2y", "5y", "max"] as const;
type Range = typeof RANGE_OPTIONS[number];

const INTERVAL_OPTIONS = ["1d", "1wk", "1mo"] as const;
type Interval = typeof INTERVAL_OPTIONS[number];

type Toast = { id: number; msg: string; variant?: "success" | "error" | "info" };

export default function App() {
  const [status, setStatus] = useState<string>("loading...");
  const [time, setTime] = useState<string>("");

  const [user, setUser] = useState<User | null>(null);
  const [checkingMe, setCheckingMe] = useState(true);

  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loadingWL, setLoadingWL] = useState(false);

  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [priceData, setPriceData] = useState<PricesResponse | null>(null);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);

  const [range, setRange] = useState<Range>("1y");
  const [interval, setInterval] = useState<Interval>("1d");

  const [mode, setMode] = useState<"day" | "swing" | "long">("swing");

  const [showSMA20, setShowSMA20] = useState(true);
  const [showSMA50, setShowSMA50] = useState(true);

  const [agent, setAgent] = useState<AgentScore | null>(null);
  const [agentErr, setAgentErr] = useState<string | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);
  function toast(msg: string, variant: Toast["variant"] = "info") {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, variant }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }

  useEffect(() => {
    getHealth()
      .then((d) => {
        setStatus(d.status);
        setTime(d.time);
      })
      .catch(() => setStatus("error"));
  }, []);

  async function refreshMe() {
    setCheckingMe(true);
    try {
      const u = await fetchMe();
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setCheckingMe(false);
    }
  }
  useEffect(() => {
    refreshMe();
  }, []);

  async function loadWatchlist() {
    setLoadingWL(true);
    try {
      const rows = await getWatchlist();
      setWatchlist(rows);

      const last = localStorage.getItem("fd:selected");
      if (last && rows.some((r) => r.symbol === last)) {
        setSelectedSymbol(last);
      } else if (!selectedSymbol && rows.length > 0) {
        setSelectedSymbol(rows[0].symbol);
      }
    } catch (e) {
      console.error(e);
      setWatchlist([]);
    } finally {
      setLoadingWL(false);
    }
  }
  useEffect(() => {
    if (user) {
      loadWatchlist();
    } else {
      setWatchlist([]);
      setSelectedSymbol(null);
    }
  }, [user]);

  useEffect(() => {
    if (!selectedSymbol) {
      setPriceData(null);
      setAgent(null);
      setAgentErr(null);
      return;
    }
    setLoadingPrices(true);
    setPriceError(null);
    getPrices(selectedSymbol, range, interval)
      .then((d) => setPriceData(d))
      .catch((e) => setPriceError(e?.message ?? "Failed to load prices"))
      .finally(() => setLoadingPrices(false));
  }, [selectedSymbol, range, interval]);

  useEffect(() => {
    if (!selectedSymbol) {
      setAgent(null);
      setAgentErr(null);
      return;
    }
    setAgentErr(null);
    getAgentScore(selectedSymbol, mode)
      .then(setAgent)
      .catch((e) => setAgentErr(e?.message ?? "Failed to score symbol"));
  }, [selectedSymbol, mode]);

  async function handleAddSymbol(symbol: string) {
    try {
      const created = await addWatchlistSymbol(symbol);
      const nextList = [...watchlist, created];
      setWatchlist(nextList);
      if (!selectedSymbol) {
        setSelectedSymbol(created.symbol);
        localStorage.setItem("fd:selected", created.symbol);
      }
      toast(`Added ${created.symbol}`, "success");
    } catch (e: any) {
      toast(e?.message ?? "Failed to add symbol", "error");
      throw e;
    }
  }

  async function handleDelete(id: number) {
    try {
      const target = watchlist.find((w) => w.id === id);
      await deleteWatchlistItem(id);
      const remaining = watchlist.filter((w) => w.id !== id);
      setWatchlist(remaining);

      if (target) toast(`Removed ${target.symbol}`, "info");

      if (target && target.symbol === selectedSymbol) {
        const next = remaining.length ? remaining[0].symbol : null;
        setSelectedSymbol(next);
        if (next) localStorage.setItem("fd:selected", next);
        else localStorage.removeItem("fd:selected");
      }
    } catch (e: any) {
      toast(e?.message ?? "Failed to remove", "error");
    }
  }

  function handleSelectSymbol(sym: string) {
    setSelectedSymbol(sym);
    localStorage.setItem("fd:selected", sym);
  }

  async function handleLogout() {
    await logoutUser();
    setUser(null);
    setWatchlist([]);
    setSelectedSymbol(null);
    setPriceData(null);
    setAgent(null);
    setAgentErr(null);
    localStorage.removeItem("fd:selected");
  }

  const priceBadge = (() => {
    if (!priceData || priceData.candles.length < 2) return null;
    const arr = priceData.candles;
    const last = arr[arr.length - 1].c;
    const prev = arr[arr.length - 2].c;
    const pct = ((last - prev) / prev) * 100;
    return (
      <span className="font-mono text-sm">
        {priceData.symbol}: {last.toFixed(2)}{" "}
        <span className={pct >= 0 ? "text-green-600" : "text-red-600"}>
          ({pct >= 0 ? "+" : ""}
          {pct.toFixed(2)}%)
        </span>
      </span>
    );
  })();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="fixed top-4 right-4 space-y-2 z-50">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2 rounded-md shadow text-sm text-white ${
              t.variant === "success"
                ? "bg-green-600"
                : t.variant === "error"
                ? "bg-red-600"
                : "bg-gray-800"
            }`}
          >
            {t.msg}
          </div>
        ))}
      </div>

      <div className="p-8 bg-white rounded-2xl shadow-xl w-[72rem]">
        <h1 className="text-3xl font-bold mb-2">FinDash</h1>
        <p className="text-gray-600 mb-6">Your personal finance dashboard</p>

        <div className="mb-4 p-4 rounded-xl border bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                status === "ok" ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span className="text-sm font-medium">Backend status:</span>
            <span className="font-mono text-sm">{status}</span>
          </div>
          {time && (
            <span className="text-xs text-gray-500">
              Last check: {new Date(time).toLocaleString()}
            </span>
          )}
        </div>

        {checkingMe ? (
          <div className="p-4 rounded-2xl border bg-yellow-50">
            Checking session…
          </div>
        ) : user ? (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl border bg-green-50 flex items-center justify-between">
              <div>
                <p className="font-medium">Signed in as</p>
                <p className="font-mono text-sm text-gray-800">{user.email}</p>
                <p className="text-xs text-gray-600 mt-1">User ID: {user.id}</p>
              </div>
              <button
                onClick={handleLogout}
                className="rounded-md bg-black text-white px-4 py-2 text-sm"
              >
                Log out
              </button>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-1 rounded-2xl border p-4">
                <h2 className="text-xl font-semibold mb-3">Watchlist</h2>

                <SymbolSearch onChoose={handleAddSymbol} />

                <div className="mt-4">
                  {loadingWL ? (
                    <div className="rounded-2xl border p-4">
                      <div className="animate-pulse space-y-2">
                        <div className="h-4 bg-gray-200 rounded" />
                        <div className="h-4 bg-gray-200 rounded" />
                        <div className="h-4 bg-gray-200 rounded" />
                      </div>
                    </div>
                  ) : watchlist.length === 0 ? (
                    <div className="rounded-2xl border p-4 bg-blue-50 text-blue-800 text-sm">
                      Your watchlist is empty. Try adding{" "}
                      <button
                        onClick={() => handleAddSymbol("AAPL")}
                        className="underline font-medium"
                      >
                        AAPL
                      </button>{" "}
                      to get started.
                    </div>
                  ) : (
                    <div className="rounded-2xl border overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-gray-100 text-gray-700 text-sm">
                          <tr>
                            <th className="px-3 py-2">Symbol</th>
                            <th className="px-3 py-2 w-28">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {watchlist.map((w) => (
                            <tr
                              key={w.id}
                              className={`border-t ${
                                selectedSymbol === w.symbol ? "bg-blue-50" : ""
                              }`}
                            >
                              <td
                                className="px-3 py-3 font-mono cursor-pointer"
                                onClick={() => handleSelectSymbol(w.symbol)}
                                title="Click to view chart"
                              >
                                {w.symbol}
                              </td>
                              <td className="px-3 py-3">
                                <button
                                  onClick={() => handleDelete(w.id)}
                                  className="rounded-md border px-3 py-1.5 text-sm"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="col-span-2">
                {!selectedSymbol ? (
                  <div className="rounded-2xl border p-6 text-gray-600">
                    Select a symbol to view its chart.
                  </div>
                ) : (
                  <div className="rounded-2xl border p-4">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Range</span>
                        <select
                          value={range}
                          onChange={(e) => setRange(e.target.value as Range)}
                          className="rounded-md border px-2 py-1 text-sm"
                        >
                          {RANGE_OPTIONS.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Interval</span>
                        <select
                          value={interval}
                          onChange={(e) => setInterval(e.target.value as Interval)}
                          className="rounded-md border px-2 py-1 text-sm"
                        >
                          {INTERVAL_OPTIONS.map((i) => (
                            <option key={i} value={i}>
                              {i}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Horizon</span>
                        <select
                          value={mode}
                          onChange={(e) =>
                            setMode(e.target.value as "day" | "swing" | "long")
                          }
                          className="rounded-md border px-2 py-1 text-sm"
                        >
                          <option value="day">Day</option>
                          <option value="swing">Swing</option>
                          <option value="long">Long</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-3 ml-2">
                        <label className="flex items-center gap-1 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={showSMA20}
                            onChange={(e) => setShowSMA20(e.target.checked)}
                          />
                          SMA20
                        </label>
                        <label className="flex items-center gap-1 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={showSMA50}
                            onChange={(e) => setShowSMA50(e.target.checked)}
                          />
                          SMA50
                        </label>
                      </div>

                      {priceData && (
                        <span className="ml-auto text-xs rounded-full border px-2 py-1 text-gray-600">
                          source: {priceData.source}
                        </span>
                      )}
                    </div>

                    {agentErr ? (
                      <div className="mb-2 text-xs text-red-600">{agentErr}</div>
                    ) : agent ? (
                      <div className="mb-3 flex items-center gap-3 text-sm">
                        <span className="rounded-full border px-2 py-0.5">
                          ML prob↑:{" "}
                          <span className="font-mono">
                            {(agent.prob_up * 100).toFixed(1)}%
                          </span>
                        </span>
                        <span className="rounded-full border px-2 py-0.5">
                          Vol:{" "}
                          <span className="font-mono">
                            {agent.volatility.toFixed(2)}
                          </span>{" "}
                          ({agent.regime})
                        </span>
                        <span className="rounded-full border px-2 py-0.5">
                          {agent.recommendation}
                        </span>
                      </div>
                    ) : null}

                    {priceBadge && <div className="mb-2">{priceBadge}</div>}

                    {loadingPrices ? (
                      <div className="rounded-2xl border p-4">
                        <div className="animate-pulse h-[420px] bg-gray-200 rounded-xl" />
                      </div>
                    ) : priceError ? (
                      <div className="rounded-2xl border p-6 text-red-600">
                        {priceError}
                      </div>
                    ) : priceData ? (
                      <PriceChart
                        symbol={priceData.symbol}
                        candles={priceData.candles}
                        indicators={{
                          ...priceData.indicators,
                        }}
                        interval={interval}
                        showSMA20={showSMA20}
                        showSMA50={showSMA50}
                      />
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <AuthForm onSuccess={refreshMe} />
        )}
      </div>
    </div>
  );
}
