import { useMemo, useState } from "react";
import { useRoundFeed } from "../mock/useRoundFeed";
import type { PassportEntry } from "../types/schemas";
import { PassportRow } from "./PassportSubmissions";

// Local-array search is a mock-only stand-in. A real implementation would
// call provenance-api's get_passport_history (Story P2) via the gateway,
// not filter a local array.
export function filterByDevice(
  entries: PassportEntry[],
  query: string,
): PassportEntry[] {
  const q = query.trim().toLowerCase();
  if (q === "") return entries;
  return entries.filter((e) => e.device_id.toLowerCase().includes(q));
}

export default function DeviceLookup() {
  const { passportEntries } = useRoundFeed();
  const [query, setQuery] = useState("");

  const matches = useMemo(
    () => filterByDevice(passportEntries, query),
    [passportEntries, query],
  );

  return (
    <div
      data-testid="device-lookup"
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
    >
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-100">Device lookup</h3>
        <span className="text-xs text-slate-500">
          mock-local search · real impl queries gateway
        </span>
      </div>

      <input
        data-testid="device-search-input"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by device id…"
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500"
      />

      {matches.length === 0 ? (
        <p
          data-testid="device-empty-state"
          className="py-4 text-center text-sm text-slate-500"
        >
          No entries match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <ul data-testid="device-results" className="mt-2 space-y-2">
          {matches.map((entry) => (
            <PassportRow
              key={`${entry.device_id}-${entry.event_type}-${entry.timestamp}`}
              entry={entry}
              index={passportEntries.indexOf(entry)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
