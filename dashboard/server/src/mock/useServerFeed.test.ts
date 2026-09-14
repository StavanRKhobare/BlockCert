import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { SYSTEM_STAGE_ORDER, TOTAL_ROUNDS } from "./serverFeed";
import { useServerFeed } from "./useServerFeed";

// One full stage cycle = idle -> 7 system stages -> idle, i.e.
// SYSTEM_STAGE_ORDER.length + 1 = 8 step() calls per round (same 8-step
// pattern as CD2 — 7 stages + idle admit only 8 transitions).
const STEPS_PER_CYCLE = SYSTEM_STAGE_ORDER.length + 1;

function stepTimes(stepFn: () => void, n: number) {
  for (let i = 0; i < n; i++) {
    stepFn();
  }
}

it("cycles stages, exposes all 8 clients per round, drifts only at 17+", () => {
  const { result } = renderHook(() => useServerFeed());

  expect(result.current.currentRound).toBe(0);
  expect(result.current.currentStage).toBe("idle");
  expect(result.current.suspicionScores).toHaveLength(0);
  expect(result.current.driftEvents).toHaveLength(0);

  // A single step enters the first system stage without completing a round.
  act(() => {
    result.current.step();
  });
  expect(result.current.currentStage).toBe("collecting_updates");
  expect(result.current.currentRound).toBe(0);
  expect(result.current.suspicionScores).toHaveLength(0);

  // Finish the cycle: back to idle, exactly one round completed, all 8
  // clients scored.
  act(() => {
    stepTimes(result.current.step, STEPS_PER_CYCLE - 1);
  });
  const round1 = result.current.suspicionScores.filter(
    (s) => s.round_number === 1,
  );
  const stageCycleCorrect =
    result.current.currentRound === 1 &&
    result.current.currentStage === "idle" &&
    result.current.suspicionScores.length === 8 &&
    new Set(round1.map((s) => s.client_did)).size === 8 &&
    result.current.checkpoints.length === 1;

  // Play/pause toggles without advancing synchronously.
  act(() => {
    result.current.play();
  });
  expect(result.current.isPlaying).toBe(true);
  act(() => {
    result.current.pause();
  });
  expect(result.current.isPlaying).toBe(false);

  // Synthetic drift is invisible before round 17 (as-of-now replay).
  act(() => {
    stepTimes(result.current.step, 15 * STEPS_PER_CYCLE);
  });
  expect(result.current.currentRound).toBe(16);
  const driftHiddenAt16 = result.current.driftEvents.length === 0;

  act(() => {
    stepTimes(result.current.step, STEPS_PER_CYCLE);
  });
  const syntheticDriftAppearsAt17 =
    driftHiddenAt16 &&
    result.current.currentRound === 17 &&
    result.current.driftEvents.length === 1 &&
    result.current.driftEvents[0].window_end_round === 17;

  // Every completed round carries all 8 clients — never just client-3.
  // Client-3 fails from round 12 on; everyone else always passes.
  const byRound = new Map<number, typeof result.current.suspicionScores>();
  for (const s of result.current.suspicionScores) {
    const arr = byRound.get(s.round_number) ?? [];
    arr.push(s);
    byRound.set(s.round_number, arr);
  }
  let all8Present = byRound.size === 17;
  let verdictsRight = true;
  for (const [round, scores] of byRound) {
    if (new Set(scores.map((s) => s.client_did)).size !== 8) {
      all8Present = false;
    }
    for (const s of scores) {
      const shouldPass = !(
        s.client_did === "did:example:client-3" && round >= 12
      );
      if (s.passed !== shouldPass) verdictsRight = false;
    }
  }
  const all8ClientsPresent = all8Present && verdictsRight;

  // Dispute snapshots accumulate: 1 @12, 2 @13, 3 @15+.
  const disputesAt17 = result.current.disputes.length === 3;

  // Reset returns to round 0 / idle / empty.
  act(() => {
    result.current.reset();
  });
  const resetWorks =
    result.current.currentRound === 0 &&
    result.current.currentStage === "idle" &&
    result.current.suspicionScores.length === 0 &&
    result.current.driftEvents.length === 0;

  // Scenario caps at TOTAL_ROUNDS.
  act(() => {
    stepTimes(result.current.step, (TOTAL_ROUNDS + 2) * STEPS_PER_CYCLE);
  });
  const capped =
    result.current.currentRound === TOTAL_ROUNDS &&
    result.current.suspicionScores.length === TOTAL_ROUNDS * 8;

  const allCorrect =
    stageCycleCorrect &&
    all8ClientsPresent &&
    syntheticDriftAppearsAt17 &&
    disputesAt17 &&
    resetWorks &&
    capped;

  console.log(
    `[SD2] stage_cycle_correct=${stageCycleCorrect} all_8_clients_present=${all8ClientsPresent} synthetic_drift_appears_at_17=${syntheticDriftAppearsAt17}`,
  );
  console.log(`[SD2] STATUS=${allCorrect ? "PASS" : "FAIL"}`);

  expect(stageCycleCorrect).toBe(true);
  expect(all8ClientsPresent).toBe(true);
  expect(syntheticDriftAppearsAt17).toBe(true);
  expect(disputesAt17).toBe(true);
  expect(resetWorks).toBe(true);
  expect(capped).toBe(true);
});
