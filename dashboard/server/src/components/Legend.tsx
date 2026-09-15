// Shared status legend (SD11 — own copy, deliberately duplicated from the
// client app so switching dashboards never requires relearning colors).
// Identical scheme: green = pass/healthy, red = fail/slashed,
// amber = pending/disputed. Every server panel's status colors were chosen
// against this: heatmap buckets, gate lights, revert edge, stake table
// accents, kanban cards.
//   green  = pass / healthy    (auth passed, contributed, stake healthy)
//   red    = fail / slashed     (auth failed, excluded, slashed, rollback)
//   amber  = pending / disputed (stage in progress, threshold, dispute flow)
// Neutral data visualization (tx hashes, block numbers, ledger rows) is
// intentionally outside this legend — those are records, not verdicts.
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
