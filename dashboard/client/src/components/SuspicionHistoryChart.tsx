import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CALIBRATED_THRESHOLD } from "../mock/roundFeed";
import { useRoundFeed } from "../mock/useRoundFeed";
import type { SuspicionScore } from "../types/schemas";

const PASS_COLOR = "#34d399";
const FAIL_COLOR = "#fb7185";

interface Point {
  round: number;
  combined: number;
  passed: boolean;
  outlier: number;
  shift: number;
  cluster: number;
}

function toPoint(s: SuspicionScore): Point {
  return {
    round: s.round_number,
    combined: s.combined_score,
    passed: s.passed,
    outlier: s.outlier_fraction,
    shift: s.mean_shift,
    cluster: s.micro_cluster_score,
  };
}

function ScoreDot(props: {
  cx?: number;
  cy?: number;
  payload?: Point;
  onSelect?: (round: number) => void;
}) {
  const { cx, cy, payload, onSelect } = props;
  if (cx == null || cy == null || !payload) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      className="score-dot"
      data-testid={`score-dot-${payload.round}`}
      fill={payload.passed ? PASS_COLOR : FAIL_COLOR}
      stroke="#020617"
      strokeWidth={1.5}
      style={{ cursor: "pointer" }}
      onClick={() => onSelect?.(payload.round)}
    />
  );
}

const BREAKDOWN_METRICS = [
  { key: "outlier", label: "Outlier fraction" },
  { key: "shift", label: "Mean shift" },
  { key: "cluster", label: "Micro-cluster" },
] as const;

export default function SuspicionHistoryChart() {
  const { suspicionHistory } = useRoundFeed();
  const [selectedRound, setSelectedRound] = useState<number | null>(null);

  const points = useMemo(() => suspicionHistory.map(toPoint), [suspicionHistory]);
  const selected: Point | undefined = useMemo(() => {
    if (points.length === 0) return undefined;
    if (selectedRound == null) return points[points.length - 1];
    return points.find((p) => p.round === selectedRound);
  }, [points, selectedRound]);

  // Bar widths are scaled per-metric to this client's own observed range in
  // the visible history — no invented global maxima.
  const maxima = useMemo(() => {
    let outlier = 0;
    let shift = 0;
    let cluster = 0;
    for (const p of points) {
      outlier = Math.max(outlier, p.outlier);
      shift = Math.max(shift, p.shift);
      cluster = Math.max(cluster, p.cluster);
    }
    return { outlier, shift, cluster };
  }, [points]);

  if (points.length === 0) {
    return (
      <div
        data-testid="suspicion-history"
        className="flex h-64 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 text-sm text-slate-500"
      >
        No rounds completed yet — press play on the round feed.
      </div>
    );
  }

  return (
    <div
      data-testid="suspicion-history"
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
    >
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-100">
          Suspicion history
        </h3>
        <span className="text-xs text-slate-500">
          threshold {CALIBRATED_THRESHOLD.toFixed(2)} · click a point for the
          breakdown
        </span>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={points}
            margin={{ top: 12, right: 12, bottom: 4, left: 0 }}
          >
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis
              dataKey="round"
              stroke="#64748b"
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              label={{
                value: "round",
                position: "insideBottomRight",
                fill: "#64748b",
                fontSize: 12,
              }}
            />
            <YAxis
              stroke="#64748b"
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              width={44}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0f172a",
                border: "1px solid #334155",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(round) => `round ${round}`}
            />
            <ReferenceLine
              y={CALIBRATED_THRESHOLD}
              stroke="#fbbf24"
              strokeDasharray="6 3"
              label={{
                value: `threshold ${CALIBRATED_THRESHOLD.toFixed(2)}`,
                position: "insideTopRight",
                fill: "#fbbf24",
                fontSize: 11,
              }}
            />
            <Line
              type="monotone"
              dataKey="combined"
              name="combined score"
              stroke="#818cf8"
              strokeWidth={2}
              dot={(dotProps) => (
                <ScoreDot
                  cx={dotProps.cx}
                  cy={dotProps.cy}
                  payload={dotProps.payload as Point | undefined}
                  onSelect={setSelectedRound}
                />
              )}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {selected && (
        <div
          data-testid={`breakdown-round-${selected.round}`}
          className="mt-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3"
        >
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Round {selected.round} — why was I{" "}
              {selected.passed ? "accepted" : "rejected"}?
            </span>
            <span
              className="text-sm font-bold tabular-nums"
              style={{ color: selected.passed ? PASS_COLOR : FAIL_COLOR }}
            >
              {selected.combined.toFixed(4)}
            </span>
          </div>
          <div className="space-y-2">
            {BREAKDOWN_METRICS.map((m) => {
              const value = selected[m.key];
              const max = maxima[m.key];
              const widthPct = max > 0 ? (value / max) * 100 : 0;
              return (
                <div key={m.key} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-xs text-slate-400">
                    {m.label}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: selected.passed
                          ? PASS_COLOR
                          : FAIL_COLOR,
                      }}
                    />
                  </div>
                  <span
                    data-testid={`breakdown-${m.key}`}
                    className="w-20 shrink-0 text-right text-xs tabular-nums text-slate-200"
                  >
                    {value.toFixed(4)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
