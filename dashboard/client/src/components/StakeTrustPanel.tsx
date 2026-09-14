import { useMemo } from "react";
import { useRoundFeed } from "../mock/useRoundFeed";
import type { StakeEvent, SuspicionScore } from "../types/schemas";

// Running balance: "staked" and "restored" add, "slashed" subtracts.
// Pure function so the test can assert the arithmetic directly.
export function computeStakeBalance(stakeEvents: StakeEvent[]): number {
  let balance = 0;
  for (const e of stakeEvents) {
    if (e.event_type === "slashed") balance -= e.amount;
    else balance += e.amount;
  }
  return balance;
}

export interface TrustScore {
  passed: number;
  total: number;
  pct: number;
}

// Trust = rounds passed / rounds participated so far. Pure function.
export function computeTrust(history: SuspicionScore[]): TrustScore {
  const total = history.length;
  if (total === 0) return { passed: 0, total: 0, pct: 0 };
  const passed = history.filter((s) => s.passed).length;
  return { passed, total, pct: (passed / total) * 100 };
}

const EVENT_STYLES: Record<StakeEvent["event_type"], string> = {
  staked: "bg-emerald-400",
  slashed: "bg-rose-400",
  restored: "bg-sky-400",
};

export default function StakeTrustPanel() {
  const { currentRound, stakeEvents, suspicionHistory } = useRoundFeed();

  const balance = useMemo(() => computeStakeBalance(stakeEvents), [stakeEvents]);
  const trust = useMemo(() => computeTrust(suspicionHistory), [suspicionHistory]);

  return (
    <div
      data-testid="stake-trust-panel"
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
    >
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-100">Stake &amp; trust</h3>
        <span className="text-xs text-slate-500">round {currentRound}</span>
      </div>

      <p data-testid="stake-balance" className="text-sm text-slate-300">
        Staked balance:{" "}
        <span className="font-bold tabular-nums text-slate-100">
          {balance.toFixed(1)}
        </span>
      </p>

      {stakeEvents.length === 0 ? (
        <p className="py-2 text-center text-sm text-slate-500">
          No stake events yet — stake on registration to begin.
        </p>
      ) : (
        <div
          data-testid="stake-timeline"
          className="mt-3 flex items-center gap-2"
        >
          {stakeEvents.map((e, i) => (
            <span
              key={i}
              data-testid={`stake-event-${e.event_type}-${e.round_number ?? i}`}
              title={`${e.event_type} ${e.amount} @ round ${e.round_number ?? "?"}${e.reason ? ` — ${e.reason}` : ""}`}
              className={`h-2.5 flex-1 rounded-full ${EVENT_STYLES[e.event_type]}`}
            />
          ))}
        </div>
      )}
      {stakeEvents.length > 0 && (
        <div className="mt-1 flex justify-between text-[11px] text-slate-500">
          {stakeEvents.map((e, i) => (
            <span key={i} className="tabular-nums">
              {e.event_type} r{e.round_number ?? "?"}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-xs text-slate-400">
            Trust — {trust.passed}/{trust.total} rounds passed
          </span>
          <span
            data-testid="trust-pct"
            className="text-sm font-bold tabular-nums text-slate-100"
          >
            {trust.pct.toFixed(1)}%
          </span>
        </div>
        <div
          data-testid="trust-gauge"
          className="h-2 overflow-hidden rounded-full bg-slate-800"
        >
          <div
            className="h-full rounded-full bg-emerald-400"
            style={{ width: `${trust.pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
