import { useState } from "react";
import { useRoundFeed } from "../mock/useRoundFeed";
import type { PassportEntry } from "../types/schemas";

export function truncateHash(hash: string): string {
  if (hash.length <= 20) return hash;
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

// Shared row format — DeviceLookup reuses this so both panels render
// entries identically.
export function PassportRow({ entry, index }: { entry: PassportEntry; index: number }) {
  const [copied, setCopied] = useState(false);

  const copyFullHash = async () => {
    try {
      await navigator.clipboard?.writeText(entry.evidence_hash);
    } catch {
      // jsdom / non-secure contexts may lack clipboard — the title
      // attribute still exposes the full hash for inspection.
    }
    setCopied(true);
  };

  return (
    <li
      data-testid="passport-row"
      data-device-id={entry.device_id}
      data-event-type={entry.event_type}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2"
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-200">
        {entry.event_type}
      </span>
      <span className="text-xs text-slate-400">{entry.device_id}</span>
      <span
        data-testid={`evidence-hash-${index}`}
        title={entry.evidence_hash}
        className="font-mono text-xs tabular-nums text-slate-300"
      >
        {truncateHash(entry.evidence_hash)}
      </span>
      <button
        type="button"
        data-testid={`copy-hash-${index}`}
        title={entry.evidence_hash}
        onClick={copyFullHash}
        className="rounded-md border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 hover:border-slate-500 hover:text-slate-100"
      >
        {copied ? "Copied!" : "Copy full hash"}
      </button>
      <time
        dateTime={new Date(entry.timestamp * 1000).toISOString()}
        className="ml-auto text-[11px] tabular-nums text-slate-500"
      >
        {new Date(entry.timestamp * 1000).toLocaleString()}
      </time>
    </li>
  );
}

export default function PassportSubmissions() {
  const { currentRound, passportEntries } = useRoundFeed();

  return (
    <div
      data-testid="passport-submissions"
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
    >
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-100">
          My passport submissions
        </h3>
        <span className="text-xs text-slate-500">round {currentRound}</span>
      </div>

      {passportEntries.length === 0 ? (
        <p
          data-testid="passport-empty-state"
          className="py-4 text-center text-sm text-slate-500"
        >
          No passport entries submitted yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {passportEntries.map((entry, i) => (
            <PassportRow key={i} entry={entry} index={i} />
          ))}
        </ul>
      )}
    </div>
  );
}
