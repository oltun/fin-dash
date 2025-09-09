import type { WatchlistItem } from "../lib/api";

export default function WatchlistTable({
  items,
  onDelete,
  busyIds = [],
}: {
  items: WatchlistItem[];
  onDelete: (id: number) => Promise<void> | void;
  busyIds?: number[];
}) {
  return (
    <div className="rounded-xl border overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-gray-100 text-gray-700 text-sm">
          <tr>
            <th className="px-4 py-2">Symbol</th>
            <th className="px-4 py-2 w-28">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td className="px-4 py-3 text-gray-500" colSpan={2}>
                No symbols yet — add one above.
              </td>
            </tr>
          ) : (
            items.map((w) => (
              <tr key={w.id} className="border-t">
                <td className="px-4 py-3 font-mono">{w.symbol}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => onDelete(w.id)}
                    disabled={busyIds.includes(w.id)}
                    className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-60"
                  >
                    {busyIds.includes(w.id) ? "Removing…" : "Remove"}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
