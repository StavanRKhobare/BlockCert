import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { FLEET_HONEST_SCORES, SUSPICION_HISTORY } from "../mock/roundFeed";
import FleetStanding, { rankAgainstFleet } from "./FleetStanding";

// Round 15: client-3 is poisoned (combined ~26.39) while the 7 others hold
// their honest values (max 9.16) — client-3 must rank most suspicious.
const HISTORY_15 = SUSPICION_HISTORY.slice(0, 15);

vi.mock("../mock/useRoundFeed", () => ({
  useRoundFeed: () => ({
    currentRound: 15,
    currentStage: "idle",
    isPlaying: false,
    suspicionHistory: HISTORY_15,
    checkpoints: [],
    stakeEvents: [],
    passportEntries: [],
    fleetScoresThisRound: FLEET_HONEST_SCORES,
  }),
}));

it("ranks the poisoned client most suspicious of 8", () => {
  render(<FleetStanding />);

  const selfScore = HISTORY_15[HISTORY_15.length - 1].combined_score;
  const rank = rankAgainstFleet(selfScore, FLEET_HONEST_SCORES);

  const percentileCorrect =
    rank.othersBelow === FLEET_HONEST_SCORES.length &&
    rank.rankOfEight === 8 &&
    selfScore > Math.max(...FLEET_HONEST_SCORES);

  const text = screen.getByTestId("fleet-rank-text").textContent ?? "";
  const textAgrees =
    text.includes(`${FLEET_HONEST_SCORES.length} of ${FLEET_HONEST_SCORES.length}`) &&
    text.includes("Most suspicious");

  // Gauge shows 7 anonymized others + 1 self dot, nothing identifying.
  const gauge = screen.getByTestId("fleet-gauge");
  const others = gauge.querySelectorAll('[data-testid="fleet-other-dot"]');
  const selfDot = screen.getByTestId("fleet-self-dot");
  const gaugeCorrect =
    others.length === FLEET_HONEST_SCORES.length &&
    selfDot.getAttribute("title")?.includes(selfScore.toFixed(4)) === true &&
    !Array.from(others).some((d) =>
      (d.getAttribute("title") ?? "").includes("client-"),
    );

  const allCorrect = percentileCorrect && textAgrees && gaugeCorrect;

  console.log(
    `[CD5] percentile_correct=${percentileCorrect} text_agrees=${textAgrees} gauge_correct=${gaugeCorrect}`,
  );
  console.log(`[CD5] STATUS=${allCorrect ? "PASS" : "FAIL"}`);

  expect(allCorrect).toBe(true);
});
