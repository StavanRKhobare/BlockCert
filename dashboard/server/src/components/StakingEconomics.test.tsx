import { render, screen } from "@testing-library/react";
import { cloneElement, isValidElement, type ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { computeStakeBalances } from "./BlockchainExplorer";
import StakingEconomics, { buildSlashSeries } from "./StakingEconomics";
import { CLIENT_DIDS, STAKE_EVENTS } from "../mock/serverFeed";

// ResponsiveContainer measures its DOM parent, which is 0x0 in jsdom, so
// bars never render there. Same seam as the client app's CD4 test: clone
// the child chart with concrete dimensions. Production stays responsive.
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) =>
      isValidElement(children)
        ? cloneElement(
            children as React.ReactElement<Record<string, unknown>>,
            { width: 560, height: 176 },
          )
        : children,
  };
});

// Round 20: full scenario — 8 x 100 staked, one 25 slash @12.
vi.mock("../mock/useServerFeed", () => ({
  useServerFeed: () => ({
    currentRound: 20,
    currentStage: "idle",
    isPlaying: false,
    clientDids: CLIENT_DIDS,
    suspicionScores: [],
    checkpoints: [],
    stakeEvents: STAKE_EVENTS,
    disputes: [],
    transactions: [],
    driftEvents: [],
  }),
}));

it("matches the mock running total and charts the round-12 slash", () => {
  render(<StakingEconomics />);

  // Running total recomputed from mock events: 800 staked − 25 slashed.
  const balances = computeStakeBalances(CLIENT_DIDS, STAKE_EVENTS);
  const expectedTotal = Object.values(balances).reduce((a, b) => a + b, 0);
  const totalText = screen.getByTestId("total-staked").textContent ?? "";
  const totalStakedCorrect =
    expectedTotal === 775 && totalText.includes(expectedTotal.toFixed(1));

  // Slash series: zeros everywhere except 25 at round 12.
  const series = buildSlashSeries(STAKE_EVENTS, 20);
  const seriesCorrect =
    series.length === 20 &&
    series.every((p, i) =>
      i + 1 === 12 ? p.slashed === 25 : p.slashed === 0,
    );

  // Security-budget line stays inside demonstrated numbers: 1 of 8 clients
  // (12.5%), ≈1/8 of stake — no invented larger percentage.
  const budgetText = screen.getByTestId("security-budget").textContent ?? "";
  const budgetCorrect =
    budgetText.includes("1 of 8") &&
    budgetText.includes("12.5%") &&
    budgetText.includes((expectedTotal / 8).toFixed(1));

  const allCorrect = totalStakedCorrect && seriesCorrect && budgetCorrect;

  console.log(`[SD8] total_staked_correct=${totalStakedCorrect && seriesCorrect}`);
  console.log(`[SD8] STATUS=${allCorrect ? "PASS" : "FAIL"}`);

  expect(totalStakedCorrect).toBe(true);
  expect(seriesCorrect).toBe(true);
  expect(budgetCorrect).toBe(true);
});
