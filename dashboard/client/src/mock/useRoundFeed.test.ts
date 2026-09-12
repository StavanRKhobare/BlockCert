import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { STAGE_ORDER, TOTAL_ROUNDS } from "./roundFeed";
import { useRoundFeed } from "./useRoundFeed";

// One full stage cycle = idle -> 7 active stages -> idle, i.e.
// STAGE_ORDER.length + 1 = 8 step() calls per round (user decision on the
// CD2 prompt's "9 times" wording — 7 stages + idle admit only 8).
const STEPS_PER_CYCLE = STAGE_ORDER.length + 1;

function stepTimes(
  stepFn: () => void,
  n: number,
  flush: (fn: () => void) => void = (fn) => fn(),
) {
  for (let i = 0; i < n; i++) {
    flush(stepFn);
  }
}

it("cycles stages, grows history per round, and resets", () => {
  const { result } = renderHook(() => useRoundFeed());

  expect(result.current.currentRound).toBe(0);
  expect(result.current.currentStage).toBe("idle");
  expect(result.current.suspicionHistory).toHaveLength(0);
  expect(result.current.checkpoints).toHaveLength(0);

  // A single step enters the first active stage without completing a round.
  act(() => {
    result.current.step();
  });
  expect(result.current.currentStage).toBe("local_training");
  expect(result.current.currentRound).toBe(0);
  expect(result.current.suspicionHistory).toHaveLength(0);

  // Finish the cycle: back to idle, exactly one round completed.
  act(() => {
    stepTimes(result.current.step, STEPS_PER_CYCLE - 1);
  });
  const stageCycleCorrect =
    result.current.currentRound === 1 &&
    result.current.currentStage === "idle" &&
    result.current.suspicionHistory.length === 1 &&
    result.current.checkpoints.length === 1;

  // History grows by exactly 1 per completed round, never more — including
  // mid-cycle (partial progress must not leak future rounds).
  act(() => {
    stepTimes(result.current.step, STEPS_PER_CYCLE);
  });
  const afterTwoRounds =
    result.current.currentRound === 2 &&
    result.current.suspicionHistory.length === 2;
  act(() => {
    stepTimes(result.current.step, 3);
  });
  const historyLengthMatchesRound =
    afterTwoRounds &&
    result.current.currentRound === 2 &&
    result.current.suspicionHistory.length === 2 &&
    result.current.checkpoints.length === 2;

  // Play/pause toggles without advancing synchronously.
  act(() => {
    result.current.play();
  });
  expect(result.current.isPlaying).toBe(true);
  act(() => {
    result.current.pause();
  });
  expect(result.current.isPlaying).toBe(false);

  // Reset returns to round 0 / idle / empty.
  act(() => {
    result.current.reset();
  });
  const resetWorks =
    result.current.currentRound === 0 &&
    result.current.currentStage === "idle" &&
    result.current.suspicionHistory.length === 0 &&
    result.current.checkpoints.length === 0 &&
    result.current.stakeEvents.length === 0 &&
    result.current.passportEntries.length === 0;

  // Scenario caps at TOTAL_ROUNDS — stepping past the end is a no-op.
  act(() => {
    stepTimes(result.current.step, (TOTAL_ROUNDS + 2) * STEPS_PER_CYCLE);
  });
  const capped =
    result.current.currentRound === TOTAL_ROUNDS &&
    result.current.suspicionHistory.length === TOTAL_ROUNDS;

  console.log(
    `[CD2] stage_cycle_correct=${stageCycleCorrect} history_length_matches_round=${historyLengthMatchesRound} reset_works=${resetWorks}`,
  );
  console.log(`[CD2] scenario_caps_at_${TOTAL_ROUNDS}=${capped}`);
  console.log(
    `[CD2] STATUS=${stageCycleCorrect && historyLengthMatchesRound && resetWorks && capped ? "PASS" : "FAIL"}`,
  );

  expect(stageCycleCorrect).toBe(true);
  expect(historyLengthMatchesRound).toBe(true);
  expect(resetWorks).toBe(true);
  expect(capped).toBe(true);
});
