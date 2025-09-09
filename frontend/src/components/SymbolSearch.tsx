import { useMemo, useState } from "react";
import { SP100 } from "../data/sp100";

const TICKER_REGEX = /^[A-Za-z.\-:]{1,10}$/;

export default function SymbolSearch({ onChoose }: { onChoose: (symbol: string) => void }) {
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  const results = useMemo(() => {
    const s = q.trim().toUpperCase();
    if (!s) return [];
    return SP100
      .filter((r) => r.symbol.startsWith(s) || r.name.toUpperCase().includes(s))
      .slice(0, 8);
  }, [q]);

  function submitSymbol(raw: string) {
    const s = raw.trim().toUpperCase();
    if (!s) return;
    if (!TICKER_REGEX.test(s)) {
      setError("Invalid format (try AAPL, MSFT, BRK.B)");
      return;
    }
    onChoose(s);
    setQ("");
    setError(null);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (results.length > 0) submitSymbol(results[0].symbol);
      else submitSymbol(q);
    }
  }

  const canQuickAdd = (() => {
    const s = q.trim().toUpperCase();
    if (!s) return false;
    if (!TICKER_REGEX.test(s)) return false;
    return !results.some(r => r.symbol === s);
  })();

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">Search or type a symbol</label>
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); if (error) setError(null); }}
        onKeyDown={onKeyDown}
        placeholder="e.g., AAPL or ‘Apple’"
        className={`mt-1 w-full rounded-md border px-3 py-2 outline-none focus:ring ${error ? "border-red-500" : ""}`}
        autoComplete="off"
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {q && (results.length > 0 || canQuickAdd) && (
        <div className="mt-2 rounded-md border bg-white shadow-sm max-h-60 overflow-auto">
          {results.map((r) => (
            <button
              key={r.symbol}
              onClick={() => submitSymbol(r.symbol)}
              className="w-full text-left px-3 py-2 hover:bg-gray-50"
              title={r.name}
            >
              <span className="font-mono">{r.symbol}</span>
              <span className="text-gray-600 text-sm ml-2">{r.name}</span>
            </button>
          ))}

          {canQuickAdd && (
            <button
              onClick={() => submitSymbol(q)}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 border-t"
              title="Add typed symbol"
            >
              <span className="text-sm">Add&nbsp;</span>
              <span className="font-mono">{q.trim().toUpperCase()}</span>
            </button>
          )}
        </div>
      )}

      {q && results.length === 0 && !canQuickAdd && (
        <div className="mt-2 text-xs text-gray-500">No matches</div>
      )}
    </div>
  );
}
