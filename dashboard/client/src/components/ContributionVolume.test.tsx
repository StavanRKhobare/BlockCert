import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import {
  ANOMALIES_DETECTED_PER_ROUND,
  IMAGES_EXAMINED_PER_ROUND,
} from "../mock/roundFeed";
import ContributionVolume, {
  computeContributionTotals,
} from "./ContributionVolume";

// Round 10: first 10 mock rounds. Uses the REAL mock feed arrays so the
// assertions check exact values, not re-typed copies.
const IMAGES_10 = IMAGES_EXAMINED_PER_ROUND.slice(0, 10);
const ANOMALIES_10 = ANOMALIES_DETECTED_PER_ROUND.slice(0, 10);

vi.mock("../mock/useRoundFeed", () => ({
  useRoundFeed: () => ({
    currentRound: 10,
    currentStage: "idle",
    isPlaying: false,
    suspicionHistory: [],
    checkpoints: [],
    stakeEvents: [],
    passportEntries: [],
    fleetScoresThisRound: [],
    imagesExamined: IMAGES_10,
    anomaliesDetected: ANOMALIES_10,
  }),
}));

it("shows cumulative totals equal to the sum of the first 10 rounds", () => {
  render(<ContributionVolume />);

  const expected = computeContributionTotals(IMAGES_10, ANOMALIES_10);
  const expectedImages = IMAGES_10.reduce((a, b) => a + b, 0);
  const expectedAnomalies = ANOMALIES_10.reduce((a, b) => a + b, 0);

  const imagesText = screen.getByTestId("total-images").textContent ?? "";
  const anomaliesText = screen.getByTestId("total-anomalies").textContent ?? "";
  const totalsCorrect =
    expected.totalImages === expectedImages &&
    expected.totalAnomalies === expectedAnomalies &&
    imagesText.includes(String(expectedImages)) &&
    anomaliesText.includes(String(expectedAnomalies));

  // One bar per completed round, each titled with its round's values.
  const bars = screen
    .getByTestId("anomaly-bars")
    .querySelectorAll('[data-testid^="anomaly-bar-"]');
  const barsCorrect =
    bars.length === 10 &&
    screen
      .getByTestId("anomaly-bar-1")
      .getAttribute("title")
      ?.includes(String(ANOMALIES_10[0])) === true;

  const cumulativeTotalsCorrect = totalsCorrect && barsCorrect;

  console.log(`[CD7] cumulative_totals_correct=${cumulativeTotalsCorrect}`);
  console.log(`[CD7] STATUS=${cumulativeTotalsCorrect ? "PASS" : "FAIL"}`);

  expect(cumulativeTotalsCorrect).toBe(true);
});
