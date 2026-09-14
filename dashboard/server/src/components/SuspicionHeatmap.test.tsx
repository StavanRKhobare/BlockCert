import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import SuspicionHeatmap, { heatBucket } from "./SuspicionHeatmap";
import {
  ATTACK_CLIENT_DID,
  CALIBRATED_THRESHOLD,
  CLIENT_DIDS,
  SUSPICION_SCORES,
} from "../mock/serverFeed";

// Round 20: the full scenario. Uses the REAL mock feed data so the color
// assertions check exact backend values, not re-typed copies.
vi.mock("../mock/useServerFeed", () => ({
  useServerFeed: () => ({
    currentRound: 20,
    currentStage: "idle",
    isPlaying: false,
    clientDids: CLIENT_DIDS,
    suspicionScores: SUSPICION_SCORES,
    checkpoints: [],
    stakeEvents: [],
    disputes: [],
    transactions: [],
    driftEvents: [],
  }),
}));

it("colors the attacker's post-12 cells over-threshold, all else under", () => {
  render(<SuspicionHeatmap />);

  const attackerIdx = CLIENT_DIDS.indexOf(ATTACK_CLIENT_DID);

  // Client-3, rounds 12-20: every cell over threshold (red).
  let attackerCorrect = true;
  for (let r = 12; r <= 20; r++) {
    const cell = screen.getByTestId(`heat-cell-${attackerIdx}-${r}`);
    const score = SUSPICION_SCORES.find(
      (s) => s.client_did === ATTACK_CLIENT_DID && s.round_number === r,
    )!.combined_score;
    if (
      cell.getAttribute("data-bucket") !== "over" ||
      !cell.classList.contains("heat-over") ||
      heatBucket(score, CALIBRATED_THRESHOLD) !== "over" ||
      cell.getAttribute("title")?.includes(score.toFixed(4)) !== true
    ) {
      attackerCorrect = false;
    }
  }
  const attackerRowCorrectlyColored = attackerCorrect;

  // Every other cell in the grid (honest clients all rounds + client-3's
  // own rounds 1-11) stays under threshold — never red.
  let honestCorrect = true;
  for (let ci = 0; ci < CLIENT_DIDS.length; ci++) {
    for (let r = 1; r <= 20; r++) {
      if (ci === attackerIdx && r >= 12) continue;
      const cell = screen.getByTestId(`heat-cell-${ci}-${r}`);
      if (
        cell.getAttribute("data-bucket") === "over" ||
        cell.classList.contains("heat-over") ||
        !cell.classList.contains("heat-under")
      ) {
        honestCorrect = false;
      }
    }
  }
  const honestRowsCorrectlyColored = honestCorrect;

  const allCorrect = attackerRowCorrectlyColored && honestRowsCorrectlyColored;

  console.log(
    `[SD4] attacker_row_correctly_colored=${attackerRowCorrectlyColored} honest_rows_correctly_colored=${honestRowsCorrectlyColored}`,
  );
  console.log(`[SD4] STATUS=${allCorrect ? "PASS" : "FAIL"}`);

  expect(attackerRowCorrectlyColored).toBe(true);
  expect(honestRowsCorrectlyColored).toBe(true);
});
