import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useServerFeed } from "../mock/useServerFeed";
import type { StakeEvent } from "../types/schemas";
import { computeStakeBalances } from "./BlockchainExplorer";

export interface SlashPoint {
  round: number;
  slashed: number;
}

// Per-round slashed totals across the fleet (staked/restored ignored —
// this series is slashes only). Pure function for direct testing.
export function buildSlashSeries(
  stakeEvents: StakeEvent[],
  totalRounds: number,
): SlashPoint[] {
  const perRound = new Map<number, number>();
  for (const e of stakeEvents) {
    if (e.event_type !== "slashed") continue;
    const round = e.round_number ?? 1;
    perRound.set(round, (perRound.get(round) ?? 0) + e.amount);
  }
  return Array.from({ length: totalRounds }, (_, i) => ({
    round: i + 1,
    slashed: perRound.get(i + 1) ?? 0,
  }));
}

export default function StakingEconomics() {
  const { currentRound, clientDids, stakeEvents } = useServerFeed();

  const balances = useMemo(
    () => computeStakeBalances(clientDids, stakeEvents),
    [clientDids, stakeEvents],
  );
  const totalStaked = useMemo(
    () => Object.values(balances).reduce((a, b) => a + b, 0),
    [balances],
  );

  const slashSeries = useMemo(
    () => buildSlashSeries(stakeEvents, currentRound),
    [stakeEvents, currentRound],
  );

  // Security-budget framing, derived only from mock-demonstrated numbers:
  // the scenario shows ONE poisoned client out of 8, so the illustrated
  // attacker share is 1/8 of clients and ~1/8 of stake — no invented
  // larger percentages.
  const attackerClients = 1;
  const attackerSharePct = (attackerClients / Math.max(clientDids.length, 1)) * 100;
  const attackerStakeApprox = totalStaked / Math.max(clientDids.length, 1);

  return (
    <div
      data-testid="staking-economics"
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
    >
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-100">
          Staking economics
        </h3>
        <span className="text-xs text-slate-500">round {currentRound}</span>
      </div>

      <p data-testid="total-staked" className="text-sm text-slate-300">
        Total staked across {clientDids.length} clients:{" "}
        <span className="font-bold tabular-nums text-slate-100">
          {totalStaked.toFixed(1)}
        </span>
      </p>
      <p
        data-testid="security-budget"
        className="mt-1 text-xs leading-relaxed text-slate-400"
      >
        Security budget: controlling {attackerClients} of {clientDids.length}{" "}
        clients ({attackerSharePct.toFixed(1)}%) means ≈{" "}
        {attackerStakeApprox.toFixed(1)} of {totalStaked.toFixed(1)} stake at
        risk — exactly what the mock scenario demonstrates with client-3.
      </p>

      <h4 className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Slashes per round
      </h4>
      {slashSeries.length === 0 ? (
        <p className="py-2 text-center text-sm text-slate-500">
          No rounds completed yet.
        </p>
      ) : (
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={slashSeries}
              margin={{ top: 8, right: 12, bottom: 4, left: 0 }}
            >
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis
                dataKey="round"
                stroke="#64748b"
                tick={{ fill: "#94a3b8", fontSize: 12 }}
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
              <Bar dataKey="slashed" name="slashed" fill="#fb7185" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <p data-testid="teacher-note-staking" className="teacher-note">
        Teacher: one red bar at round 12 — a single slash moves the whole
        security budget line above.
      </p>
    </div>
  );
}
