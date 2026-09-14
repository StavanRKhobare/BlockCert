import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import BlockchainExplorer, { computeStakeBalances } from "./BlockchainExplorer";
import { CLIENT_DIDS, STAKE_EVENTS, TRANSACTIONS } from "../mock/serverFeed";

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
    transactions: TRANSACTIONS,
    driftEvents: [],
  }),
}));

it("matches mock stake balances and orders the tx feed newest-first", () => {
  render(<BlockchainExplorer />);

  // Expected balances recomputed from the mock events (not re-typed):
  // 100 staked each @1, client-3 slashed 25 @12.
  const expected = computeStakeBalances(CLIENT_DIDS, STAKE_EVENTS);
  let stakeTableCorrect =
    expected["did:example:client-3"] === 75 &&
    CLIENT_DIDS.filter((d) => d !== "did:example:client-3").every(
      (d) => expected[d] === 100,
    );
  for (const did of CLIENT_DIDS) {
    const short = did.replace("did:example:", "");
    const row = screen.getByTestId(`stake-row-${short}`);
    if (
      row.getAttribute("data-balance") !== String(expected[did]) ||
      row.textContent?.includes(expected[did].toFixed(1)) !== true
    ) {
      stakeTableCorrect = false;
    }
  }

  // Feed newest-first: block numbers strictly descending down the list.
  const rows = screen.getAllByTestId("tx-row");
  const blocks = rows.map((r) => Number(r.getAttribute("data-block")));
  const newestFirst =
    blocks.length === TRANSACTIONS.length &&
    blocks.every((b, i) => i === 0 || blocks[i - 1] > b);

  // Ticker shows the chain head visible so far.
  const tickerCorrect =
    screen.getByTestId("block-height").textContent ===
    String(Math.max(...TRANSACTIONS.map((t) => t.block_number)));

  console.log(`[SD7] stake_table_correct=${stakeTableCorrect}`);

  expect(stakeTableCorrect).toBe(true);
  expect(newestFirst).toBe(true);
  expect(tickerCorrect).toBe(true);
});
