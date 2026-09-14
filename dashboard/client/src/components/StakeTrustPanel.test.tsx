import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { STAKE_EVENTS, SUSPICION_HISTORY } from "../mock/roundFeed";
import StakeTrustPanel, {
  computeStakeBalance,
  computeTrust,
} from "./StakeTrustPanel";

// Round 20: full scenario — 100.0 staked @1, 25.0 slashed @12; 11 of 20
// rounds passed (rounds 1-11 honest, 12-20 poisoned). Uses the REAL mock
// feed data so the assertions check exact backend values, not re-typed
// copies.
const HISTORY_20 = SUSPICION_HISTORY.slice(0, 20);

vi.mock("../mock/useRoundFeed", () => ({
  useRoundFeed: () => ({
    currentRound: 20,
    currentStage: "idle",
    isPlaying: false,
    suspicionHistory: HISTORY_20,
    checkpoints: [],
    stakeEvents: STAKE_EVENTS,
    passportEntries: [],
    fleetScoresThisRound: [],
  }),
}));

it("shows the exact running balance and 11/20 trust at round 20", () => {
  render(<StakeTrustPanel />);

  const expectedBalance = computeStakeBalance(STAKE_EVENTS);
  const balanceText = screen.getByTestId("stake-balance").textContent ?? "";
  const balanceCorrect =
    expectedBalance === 75 &&
    balanceText.includes(expectedBalance.toFixed(1));

  // Timeline strip: one color-coded segment per stake event.
  const timeline = screen.getByTestId("stake-timeline");
  const stakedSeg = timeline.querySelector('[data-testid="stake-event-staked-1"]');
  const slashedSeg = timeline.querySelector(
    '[data-testid="stake-event-slashed-12"]',
  );
  const timelineCorrect =
    stakedSeg?.classList.contains("bg-emerald-400") === true &&
    slashedSeg?.classList.contains("bg-rose-400") === true;

  const trust = computeTrust(HISTORY_20);
  const trustText = screen.getByTestId("trust-pct").textContent ?? "";
  const trustPctCorrect =
    trust.passed === 11 &&
    trust.total === 20 &&
    Math.abs(trust.pct - (11 / 20) * 100) < 1e-9 &&
    trustText.includes(trust.pct.toFixed(1));

  const allCorrect = balanceCorrect && timelineCorrect && trustPctCorrect;

  console.log(
    `[CD6] balance_correct=${balanceCorrect && timelineCorrect} trust_pct_correct=${trustPctCorrect}`,
  );
  console.log(`[CD6] STATUS=${allCorrect ? "PASS" : "FAIL"}`);

  expect(balanceCorrect).toBe(true);
  expect(timelineCorrect).toBe(true);
  expect(trustPctCorrect).toBe(true);
});
