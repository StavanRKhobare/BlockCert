import { useMemo } from "react";
import { useServerFeed } from "../mock/useServerFeed";
import type { Checkpoint, SuspicionScore } from "../types/schemas";

// Mirror of rollback-service's DriftMonitor defaults (window_tracker.py):
// window_size=5, drift_threshold=2.0. The gate below replays the SAME
// arithmetic on the feed's completed rounds — nothing hardcoded.
export const DRIFT_WINDOW_SIZE = 5;
export const DRIFT_THRESHOLD = 2.0;

export interface RoundSignal {
  round: number;
  meanScore: number;
  accuracy: number;
}

export interface GateState {
  windowFull: boolean;
  sustainedSuspicion: boolean;
  accuracyDeclining: boolean;
}

// Pure replay of DriftMonitor.ingest_round's AND-condition over the last
// WINDOW_SIZE completed rounds: mean-of-means > threshold AND
// (last accuracy - first accuracy) < 0. Needs a full window, like the real
// monitor (which returns None until then).
export function evaluateDriftGate(signals: RoundSignal[]): GateState {
  const window = signals.slice(-DRIFT_WINDOW_SIZE);
  if (window.length < DRIFT_WINDOW_SIZE) {
    return { windowFull: false, sustainedSuspicion: false, accuracyDeclining: false };
  }
  const avgScore = window.reduce((a, s) => a + s.meanScore, 0) / window.length;
  const accuracyTrend = window[window.length - 1].accuracy - window[0].accuracy;
  return {
    windowFull: true,
    sustainedSuspicion: avgScore > DRIFT_THRESHOLD,
    accuracyDeclining: accuracyTrend < 0,
  };
}

export function buildRoundSignals(
  suspicionScores: SuspicionScore[],
  checkpoints: Checkpoint[],
): RoundSignal[] {
  const accByRound = new Map<number, number>();
  for (const cp of checkpoints) {
    const acc = cp.reference_set_metrics["reference_set_accuracy"];
    if (typeof acc === "number") accByRound.set(cp.round_number, acc);
  }
  const scoresByRound = new Map<number, number[]>();
  for (const s of suspicionScores) {
    const arr = scoresByRound.get(s.round_number) ?? [];
    arr.push(s.combined_score);
    scoresByRound.set(s.round_number, arr);
  }
  const rounds = [...scoresByRound.keys()].sort((a, b) => a - b);
  return rounds.flatMap((round) => {
    const scores = scoresByRound.get(round)!;
    const accuracy = accByRound.get(round);
    if (scores.length === 0 || accuracy == null) return [];
    return [
      {
        round,
        meanScore: scores.reduce((a, b) => a + b, 0) / scores.length,
        accuracy,
      },
    ];
  });
}

function Light({
  id,
  label,
  lit,
  litClass,
}: {
  id: string;
  label: string;
  lit: boolean;
  litClass: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        data-testid={id}
        data-lit={lit}
        aria-label={`${label}: ${lit ? "on" : "off"}`}
        className={`h-4 w-4 rounded-full border ${
          lit ? litClass : "border-slate-700 bg-slate-800"
        }`}
      />
      <span className="text-sm text-slate-300">{label}</span>
    </div>
  );
}

export default function DriftMonitorGate() {
  const { currentRound, suspicionScores, checkpoints, driftEvents } =
    useServerFeed();

  const gate = useMemo(() => {
    const signals = buildRoundSignals(suspicionScores, checkpoints);
    return evaluateDriftGate(signals);
  }, [suspicionScores, checkpoints]);

  // ROLLBACK lights only when both halves hold AND the (synthetic) drift
  // event has actually arrived in the feed — in this scenario that is
  // exactly currentRound >= 17, but the event presence (not the round
  // number) is the honest trigger: a real future event would light it on
  // whatever round it lands.
  const rollbackLit =
    gate.sustainedSuspicion && gate.accuracyDeclining && driftEvents.length > 0;

  return (
    <div
      data-testid="drift-monitor-gate"
      id="panel-rollback"
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
    >
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-100">
          Drift monitor AND-gate
        </h3>
        <span className="text-xs text-slate-500">
          window {DRIFT_WINDOW_SIZE} · threshold {DRIFT_THRESHOLD} · round {currentRound}
        </span>
      </div>

      <div className="space-y-2">
        <Light
          id="gate-suspicion"
          label="Sustained Suspicion"
          lit={gate.sustainedSuspicion}
          litClass="border-amber-300 bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]"
        />
        <Light
          id="gate-accuracy"
          label="Accuracy Declining"
          lit={gate.accuracyDeclining}
          litClass="border-amber-300 bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]"
        />
        <Light
          id="gate-rollback"
          label="ROLLBACK TRIGGERED"
          lit={rollbackLit}
          litClass="border-rose-300 bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.9)]"
        />
      </div>

      {!gate.windowFull && (
        <p className="mt-2 text-xs text-slate-500">
          Collecting window — needs {DRIFT_WINDOW_SIZE} completed rounds.
        </p>
      )}
      {rollbackLit && (
        <p
          data-testid="synthetic-standin-note"
          className="mt-2 rounded-lg border border-amber-400/40 bg-amber-500/10 p-2 text-xs text-amber-100"
        >
          Demo stand-in: this rollback reflects the ONE synthetic drift event
          in the mock feed — the real DriftMonitor cannot trigger yet
          (reference-set accuracy is still a placeholder constant).
        </p>
      )}
      <p data-testid="teacher-note-driftgate" className="teacher-note">
        Teacher: two amber halves make a red whole — suspicion has been high
        since round 5, accuracy slides from round 12, rollback fires at 17.
      </p>
    </div>
  );
}
