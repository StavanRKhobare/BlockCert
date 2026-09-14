import { useMemo } from "react";
import { useRoundFeed } from "../mock/useRoundFeed";

export interface ContributionTotals {
  totalImages: number;
  totalAnomalies: number;
}

// Running totals over completed rounds. Pure function so the test can
// assert the arithmetic directly.
export function computeContributionTotals(
  imagesExamined: number[],
  anomaliesDetected: number[],
): ContributionTotals {
  return {
    totalImages: imagesExamined.reduce((a, b) => a + b, 0),
    totalAnomalies: anomaliesDetected.reduce((a, b) => a + b, 0),
  };
}

export default function ContributionVolume() {
  const { currentRound, imagesExamined, anomaliesDetected } = useRoundFeed();

  const totals = useMemo(
    () => computeContributionTotals(imagesExamined, anomaliesDetected),
    [imagesExamined, anomaliesDetected],
  );

  const maxAnomalies = useMemo(
    () => Math.max(0, ...anomaliesDetected),
    [anomaliesDetected],
  );

  return (
    <div
      data-testid="contribution-volume"
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
    >
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-100">
          Contribution volume
        </h3>
        <span className="text-xs text-slate-500">round {currentRound}</span>
      </div>

      {imagesExamined.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">
          No rounds completed yet — contributions appear after round 1.
        </p>
      ) : (
        <>
          <div className="flex gap-6">
            <p data-testid="total-images" className="text-sm text-slate-300">
              Images examined:{" "}
              <span className="font-bold tabular-nums text-slate-100">
                {totals.totalImages}
              </span>
            </p>
            <p data-testid="total-anomalies" className="text-sm text-slate-300">
              Anomalies detected:{" "}
              <span className="font-bold tabular-nums text-slate-100">
                {totals.totalAnomalies}
              </span>
            </p>
          </div>

          <div
            data-testid="anomaly-bars"
            className="mt-3 flex h-20 items-end gap-1"
          >
            {anomaliesDetected.map((count, i) => (
              <div
                key={i}
                data-testid={`anomaly-bar-${i + 1}`}
                title={`round ${i + 1}: ${count} anomalies / ${imagesExamined[i]} images`}
                className="flex-1 rounded-sm bg-indigo-400"
                style={{
                  height: `${maxAnomalies > 0 ? (count / maxAnomalies) * 100 : 0}%`,
                  minHeight: count > 0 ? 4 : 0,
                }}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[11px] tabular-nums text-slate-500">
            <span>round 1</span>
            <span>round {anomaliesDetected.length}</span>
          </div>
        </>
      )}
    </div>
  );
}
