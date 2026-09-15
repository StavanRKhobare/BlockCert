import { useMemo } from "react";
import { useServerFeed } from "../mock/useServerFeed";

export function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

// System-wide view: EVERY passport entry across ALL devices, most recent
// first — the aggregate counterpart to the client app's single-device
// DeviceLookup (CD8), which filters to one device_id.
export default function ProvenanceLedger() {
  const { currentRound, passportEntries } = useServerFeed();

  const recentFirst = useMemo(() => [...passportEntries].reverse(), [passportEntries]);

  const deviceCount = useMemo(
    () => new Set(passportEntries.map((e) => e.device_id)).size,
    [passportEntries],
  );

  return (
    <div
      data-testid="provenance-ledger"
      id="panel-provenance"
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
    >
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-100">
          Provenance ledger
        </h3>
        <span className="text-xs text-slate-500">
          {passportEntries.length} entries · {deviceCount} devices · round {currentRound}
        </span>
      </div>

      {recentFirst.length === 0 ? (
        <p
          data-testid="provenance-empty-state"
          className="py-4 text-center text-sm text-slate-500"
        >
          No passport entries submitted yet.
        </p>
      ) : (
        <ul data-testid="provenance-feed" className="max-h-64 space-y-1 overflow-y-auto pr-1">
          {recentFirst.map((entry) => (
            <li
              key={`${entry.device_id}-${entry.event_type}-${entry.timestamp}`}
              data-testid="provenance-row"
              data-device-id={entry.device_id}
              data-event-type={entry.event_type}
              className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-lg border border-slate-800 bg-slate-950/70 px-2 py-1 text-xs"
            >
              <span className="font-semibold text-slate-200">{entry.device_id}</span>
              <span className="uppercase tracking-wide text-slate-400">
                {entry.event_type}
              </span>
              <span
                title={entry.actor_did}
                className="text-slate-500"
              >
                {entry.actor_did.replace("did:example:", "")}
              </span>
              <span
                title={entry.evidence_hash}
                className="ml-auto font-mono tabular-nums text-slate-300"
              >
                {shortHash(entry.evidence_hash)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p data-testid="teacher-note-provenance" className="teacher-note">
        Teacher: every device lifecycle event lands here — newest first,
        across all devices, not just one.
      </p>
    </div>
  );
}
