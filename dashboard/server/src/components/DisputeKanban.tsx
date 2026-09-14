import { motion } from "framer-motion";
import { useMemo } from "react";
import { useServerFeed } from "../mock/useServerFeed";
import type { Dispute, DisputeStatus } from "../types/schemas";

type ColumnId = "provisional" | "challenge" | "finalized";

const COLUMNS: Array<{ id: ColumnId; title: string; statuses: DisputeStatus[] }> = [
  { id: "provisional", title: "Provisional", statuses: ["provisionally_rejected"] },
  { id: "challenge", title: "Challenge Window", statuses: ["challenge_window"] },
  {
    id: "finalized",
    title: "Finalized or Overturned",
    statuses: ["finalized_rejected", "overturned"],
  },
];

export function columnForStatus(status: DisputeStatus): ColumnId {
  const col = COLUMNS.find((c) => c.statuses.includes(status));
  if (!col) throw new Error(`unknown dispute status: ${status}`);
  return col.id;
}

// Latest visible snapshot per dispute_id: the feed exposes status snapshots
// up to currentRound, so the card shows the dispute "as of now" and glides
// between columns as rounds advance. Pure function for direct testing.
export function latestSnapshotPerDispute(disputes: Dispute[]): Dispute[] {
  const latest = new Map<number, Dispute>();
  for (const d of disputes) latest.set(d.dispute_id, d);
  return [...latest.values()].sort((a, b) => a.dispute_id - b.dispute_id);
}

export default function DisputeKanban() {
  const { currentRound, disputes } = useServerFeed();

  const cards = useMemo(() => latestSnapshotPerDispute(disputes), [disputes]);

  const byColumn = useMemo(() => {
    const map: Record<ColumnId, Dispute[]> = {
      provisional: [],
      challenge: [],
      finalized: [],
    };
    for (const d of cards) map[columnForStatus(d.status)].push(d);
    return map;
  }, [cards]);

  return (
    <div
      data-testid="dispute-kanban"
      id="panel-disputes"
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
    >
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-100">
          Dispute kanban
        </h3>
        <span className="text-xs text-slate-500">round {currentRound}</span>
      </div>

      {cards.length === 0 ? (
        <p
          data-testid="kanban-empty-state"
          className="py-4 text-center text-sm text-slate-500"
        >
          No disputes filed yet.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {COLUMNS.map((col) => (
            <section
              key={col.id}
              data-testid={`kanban-${col.id}`}
              aria-label={col.title}
              className="rounded-lg border border-slate-800 bg-slate-950/50 p-2"
            >
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {col.title}{" "}
                <span className="tabular-nums">({byColumn[col.id].length})</span>
              </h4>
              <div className="space-y-2">
                {byColumn[col.id].map((d) => (
                  <motion.article
                    key={d.dispute_id}
                    data-testid={`dispute-card-${d.dispute_id}`}
                    data-status={d.status}
                    layout
                    transition={{ type: "spring", stiffness: 350, damping: 32 }}
                    className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-2"
                  >
                    <p className="text-xs font-semibold text-slate-100">
                      Dispute #{d.dispute_id} · {d.client_did.replace("did:example:", "")}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      round {d.round_number} · {d.status.replaceAll("_", " ")}
                    </p>
                    <p className="mt-1 text-xs text-slate-300">{d.reason}</p>
                  </motion.article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      <p data-testid="teacher-note-kanban" className="teacher-note">
        Teacher: one card, three columns — the dispute glides right as the
        challenge window opens and closes.
      </p>
    </div>
  );
}
