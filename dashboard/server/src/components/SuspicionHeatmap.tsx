import { useMemo } from "react";
import { CALIBRATED_THRESHOLD } from "../mock/serverFeed";
import { useServerFeed } from "../mock/useServerFeed";

export type HeatBucket = "ok" | "near" | "over";

// Cell color bucket for a combined score against the calibrated threshold:
// red once over, amber in the near band (>=75% of threshold), green below.
// Pure function so the test can assert the bucketing directly.
export function heatBucket(score: number, threshold: number): HeatBucket {
  if (score >= threshold) return "over";
  if (score >= 0.75 * threshold) return "near";
  return "ok";
}

const BUCKET_STYLES: Record<HeatBucket, string> = {
  ok: "bg-emerald-500/70",
  near: "bg-amber-400/80",
  over: "bg-rose-500",
};

export default function SuspicionHeatmap() {
  const { currentRound, clientDids, suspicionScores } = useServerFeed();

  const byClientRound = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of suspicionScores) {
      map.set(`${s.client_did}|${s.round_number}`, s.combined_score);
    }
    return map;
  }, [suspicionScores]);

  const rounds = useMemo(
    () => Array.from({ length: currentRound }, (_, i) => i + 1),
    [currentRound],
  );

  return (
    <div
      data-testid="suspicion-heatmap"
      id="panel-auth"
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
    >
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-100">
          Fleet suspicion heatmap
        </h3>
        <span className="text-xs text-slate-500">
          threshold {CALIBRATED_THRESHOLD.toFixed(2)} · hover a cell for its score
        </span>
      </div>

      {currentRound === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">
          No rounds completed yet — press play on the server feed.
        </p>
      ) : (
        <>
          <div
            data-testid="heatmap-grid"
            className="grid gap-1"
            style={{
              gridTemplateColumns: `auto repeat(${rounds.length}, minmax(0, 1fr))`,
            }}
          >
            <span />
            {rounds.map((r) => (
              <span
                key={r}
                className="text-center text-[10px] tabular-nums text-slate-500"
              >
                {r}
              </span>
            ))}
            {clientDids.map((did, ci) => (
              <RowLabel key={did} did={did} ci={ci} rounds={rounds} map={byClientRound} />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-4 text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/70" /> under
              threshold
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-400/80" /> near
              threshold
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" /> over
              threshold
            </span>
          </div>
        </>
      )}
      <p data-testid="teacher-note-heatmap" className="teacher-note">
        Teacher: rows are clients, columns are rounds — the solid red block
        is client-3 turning poisoned at round 12 while everyone else stays
        green.
      </p>
    </div>
  );
}

function RowLabel({
  did,
  ci,
  rounds,
  map,
}: {
  did: string;
  ci: number;
  rounds: number[];
  map: Map<string, number>;
}) {
  const short = did.replace("did:example:", "");
  return (
    <>
      <span title={did} className="pr-1 text-[11px] tabular-nums text-slate-400">
        {short}
      </span>
      {rounds.map((r) => {
        const score = map.get(`${did}|${r}`);
        const bucket = score == null ? "ok" : heatBucket(score, CALIBRATED_THRESHOLD);
        return (
          <div
            key={r}
            data-testid={`heat-cell-${ci}-${r}`}
            data-client-did={did}
            data-round={r}
            data-bucket={bucket}
            title={
              score == null
                ? `${did} round ${r}: no score yet`
                : `${did} round ${r}: combined ${score.toFixed(4)} (threshold ${CALIBRATED_THRESHOLD.toFixed(2)})`
            }
            className={`heat-cell h-5 rounded-sm ${BUCKET_STYLES[bucket]} ${bucket === "over" ? "heat-over" : "heat-under"}`}
          />
        );
      })}
    </>
  );
}
