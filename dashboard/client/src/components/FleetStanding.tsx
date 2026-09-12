import { useMemo } from "react";
import { useRoundFeed } from "../mock/useRoundFeed";

export interface FleetRank {
  selfScore: number | null;
  othersBelow: number;
  othersTotal: number;
  rankOfEight: number;
}

// Rank this client's latest combined score against the 7 anonymized fleet
// scores. Higher combined score = more suspicious = higher rank. Pure
// function so the test can assert the arithmetic directly.
export function rankAgainstFleet(
  selfScore: number | null,
  fleetScores: number[],
): FleetRank {
  if (selfScore == null) {
    return {
      selfScore: null,
      othersBelow: 0,
      othersTotal: fleetScores.length,
      rankOfEight: 0,
    };
  }
  const othersBelow = fleetScores.filter((s) => s < selfScore).length;
  return {
    selfScore,
    othersBelow,
    othersTotal: fleetScores.length,
    rankOfEight: othersBelow + 1,
  };
}

export default function FleetStanding() {
  const { currentRound, suspicionHistory, fleetScoresThisRound } =
    useRoundFeed();

  const rank = useMemo(() => {
    const latest = suspicionHistory[suspicionHistory.length - 1];
    return rankAgainstFleet(
      latest ? latest.combined_score : null,
      fleetScoresThisRound,
    );
  }, [suspicionHistory, fleetScoresThisRound]);

  const allScores = useMemo(() => {
    const scores =
      rank.selfScore == null
        ? [...fleetScoresThisRound]
        : [...fleetScoresThisRound, rank.selfScore];
    return [...scores].sort((a, b) => a - b);
  }, [fleetScoresThisRound, rank.selfScore]);

  const min = allScores.length > 0 ? allScores[0] : 0;
  const max =
    allScores.length > 0 ? allScores[allScores.length - 1] : 1;
  const span = max - min > 0 ? max - min : 1;
  const pct = (v: number) => ((v - min) / span) * 100;

  return (
    <div
      data-testid="fleet-standing"
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
    >
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-100">
          Fleet standing
        </h3>
        <span className="text-xs text-slate-500">
          anonymized · round {currentRound}
        </span>
      </div>

      {rank.selfScore == null ? (
        <p className="py-4 text-center text-sm text-slate-500">
          No score yet this session — complete a round to rank yourself.
        </p>
      ) : (
        <>
          <p data-testid="fleet-rank-text" className="text-sm text-slate-300">
            {rank.othersBelow === rank.othersTotal ? (
              <>
                Most suspicious of 8 — higher than all{" "}
                <span className="font-bold text-rose-300">
                  {rank.othersTotal} of {rank.othersTotal}
                </span>{" "}
                other clients this round.
              </>
            ) : (
              <>
                Lower than{" "}
                <span className="font-bold text-emerald-300">
                  {rank.othersTotal - rank.othersBelow} of {rank.othersTotal}
                </span>{" "}
                other clients this round (rank {rank.rankOfEight} of 8 by
                suspicion).
              </>
            )}
          </p>
          <div
            data-testid="fleet-gauge"
            className="relative mt-5 h-2 rounded-full bg-slate-800"
          >
            {fleetScoresThisRound.map((s, i) => (
              <span
                key={i}
                data-testid="fleet-other-dot"
                title="Another client (anonymized)"
                className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-500"
                style={{ left: `${pct(s)}%` }}
              />
            ))}
            <span
              data-testid="fleet-self-dot"
              title={`You: ${rank.selfScore.toFixed(4)}`}
              className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-950 bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.8)]"
              style={{ left: `${pct(rank.selfScore)}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[11px] tabular-nums text-slate-500">
            <span>{min.toFixed(1)} least suspicious</span>
            <span>{max.toFixed(1)} most suspicious</span>
          </div>
        </>
      )}
    </div>
  );
}
