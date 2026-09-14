import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import DriftMonitorGate, {
  buildRoundSignals,
  evaluateDriftGate,
} from "./DriftMonitorGate";
import {
  CHECKPOINTS,
  DRIFT_EVENTS,
  DRIFT_EVENT_ROUND,
  SUSPICION_SCORES,
} from "../mock/serverFeed";

// Feed slices rebuilt from the REAL mock arrays per rendered round.
const { feed } = vi.hoisted(() => ({
  feed: {
    currentRound: 0,
    currentStage: "idle",
    isPlaying: false,
    clientDids: [],
    suspicionScores: [] as typeof SUSPICION_SCORES,
    checkpoints: [] as typeof CHECKPOINTS,
    stakeEvents: [],
    disputes: [],
    transactions: [],
    driftEvents: [] as typeof DRIFT_EVENTS,
  },
}));

vi.mock("../mock/useServerFeed", () => ({
  useServerFeed: () => feed,
}));

function setRound(n: number) {
  feed.currentRound = n;
  feed.suspicionScores = SUSPICION_SCORES.filter((s) => s.round_number <= n);
  feed.checkpoints = CHECKPOINTS.slice(0, n);
  feed.driftEvents = DRIFT_EVENTS.filter(() => DRIFT_EVENT_ROUND <= n);
}

function lit(id: string): boolean {
  return screen.getByTestId(id).getAttribute("data-lit") === "true";
}

it("lights each half from computed window state, rollback only at 17+", () => {
  // Round 3: window not full — everything off.
  setRound(3);
  const { unmount: u1 } = render(<DriftMonitorGate />);
  const earlyOff = !lit("gate-suspicion") && !lit("gate-accuracy") && !lit("gate-rollback");
  u1();

  // Round 12: suspicion sustained (window means ~8-10 > 2.0) and accuracy
  // already sliding (0.94 -> 0.93) — but no drift event yet, so no rollback.
  setRound(12);
  const { unmount: u2 } = render(<DriftMonitorGate />);
  const halvesComputedAt12 = lit("gate-suspicion") && lit("gate-accuracy");
  const rollbackOffAt12 = !lit("gate-rollback");
  u2();

  // Round 16: both halves still on, rollback still off.
  setRound(16);
  const { unmount: u3 } = render(<DriftMonitorGate />);
  const rollbackOffAt16 = lit("gate-suspicion") && lit("gate-accuracy") && !lit("gate-rollback");
  u3();

  // Round 17: synthetic event arrives — rollback lights, honestly labeled.
  setRound(17);
  const { unmount: u4 } = render(<DriftMonitorGate />);
  const rollbackOnAt17 =
    lit("gate-suspicion") && lit("gate-accuracy") && lit("gate-rollback");
  const standinLabeled =
    screen.queryByTestId("synthetic-standin-note")?.textContent?.includes("stand-in") === true;
  u4();

  // Round 20: stays lit.
  setRound(20);
  render(<DriftMonitorGate />);
  const rollbackOnAt20 = lit("gate-rollback");

  // The pure gate agrees with the rendered lights (guards against a
  // component that hardcodes instead of computing).
  setRound(16);
  const pure16 = evaluateDriftGate(buildRoundSignals(feed.suspicionScores, feed.checkpoints));
  const pureAgrees = pure16.sustainedSuspicion && pure16.accuracyDeclining;

  const andGateLogicCorrect =
    earlyOff &&
    halvesComputedAt12 &&
    rollbackOffAt12 &&
    rollbackOffAt16 &&
    rollbackOnAt17 &&
    standinLabeled &&
    rollbackOnAt20 &&
    pureAgrees;

  console.log(`[SD6] and_gate_logic_correct=${andGateLogicCorrect}`);

  expect(andGateLogicCorrect).toBe(true);
});
