// Shared status legend (CD9). Every panel's status colors were audited
// against this single source of truth:
//   green  = pass / healthy    (auth passed, stake healthy, trust high)
//   red    = fail / slashed     (auth failed, stake slashed, trust low)
//   amber  = pending / disputed (pipeline stage in progress, auth threshold,
//                               mid-range trust)
// Neutral data visualization (fleet dots, anomaly bars, passport rows) is
// intentionally outside this legend — those are counts/positions, not
// verdicts.
const ITEMS = [
  {
    id: "pass",
    dot: "bg-emerald-400",
    label: "Pass / healthy",
  },
  {
    id: "fail",
    dot: "bg-rose-400",
    label: "Fail / slashed",
  },
  {
    id: "pending",
    dot: "bg-amber-400",
    label: "Pending / disputed",
  },
] as const;

export default function Legend() {
  return (
    <aside
      data-testid="legend"
      aria-label="Status color legend"
      className="fixed bottom-4 right-4 z-50 rounded-xl border border-slate-700 bg-slate-950/95 p-3 shadow-xl"
    >
      <ul className="space-y-1.5">
        {ITEMS.map((item) => (
          <li
            key={item.id}
            data-testid={`legend-${item.id}`}
            className="flex items-center gap-2 text-xs text-slate-200"
          >
            <span
              aria-hidden="true"
              className={`h-3 w-3 rounded-full ${item.dot}`}
            />
            {item.label}
          </li>
        ))}
      </ul>
    </aside>
  );
}
