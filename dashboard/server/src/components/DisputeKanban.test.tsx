import { render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { computeStakeBalances } from "./BlockchainExplorer";
import DisputeKanban, {
  columnForStatus,
  latestSnapshotPerDispute,
} from "./DisputeKanban";
import {
  CLIENT_DIDS,
  DISPUTES,
  DISPUTE_ROUNDS,
  STAKE_EVENTS,
} from "../mock/serverFeed";

// Feed slices rebuilt from the REAL mock arrays per rendered round.
const { feed } = vi.hoisted(() => ({
  feed: {
    currentRound: 0,
    currentStage: "idle",
    isPlaying: false,
    clientDids: [] as string[],
    suspicionScores: [],
    checkpoints: [],
    stakeEvents: [] as typeof STAKE_EVENTS,
    disputes: [] as typeof DISPUTES,
    transactions: [],
    driftEvents: [],
  },
}));

vi.mock("../mock/useServerFeed", () => ({
  useServerFeed: () => feed,
}));

function setRound(n: number) {
  feed.currentRound = n;
  feed.clientDids = CLIENT_DIDS;
  feed.stakeEvents = STAKE_EVENTS.filter((e) => (e.round_number ?? 1) <= n);
  feed.disputes = DISPUTES.filter((_, i) => DISPUTE_ROUNDS[i] <= n);
}

function columnOfCard(): string | null {
  for (const col of ["provisional", "challenge", "finalized"] as const) {
    const section = screen.getByTestId(`kanban-${col}`);
    if (within(section).queryByTestId("dispute-card-1") != null) return col;
  }
  return null;
}

it("moves the round-12 dispute across columns as rounds advance", () => {
  // Pure mapping sanity: every status resolves to its spec'd column.
  const mappingSane =
    columnForStatus("provisionally_rejected") === "provisional" &&
    columnForStatus("challenge_window") === "challenge" &&
    columnForStatus("finalized_rejected") === "finalized" &&
    columnForStatus("overturned") === "finalized" &&
    latestSnapshotPerDispute(DISPUTES).length === 1;

  // Round 11: nothing filed yet — empty state, no card anywhere.
  setRound(11);
  const { unmount: u1 } = render(<DisputeKanban />);
  const emptyBefore =
    screen.queryByTestId("kanban-empty-state") != null &&
    screen.queryByTestId("dispute-card-1") == null;
  u1();

  // Round 12: filed → Provisional.
  setRound(12);
  const { unmount: u2 } = render(<DisputeKanban />);
  const provisionalAt12 = columnOfCard() === "provisional";
  u2();

  // Round 13: challenge window opens → middle column.
  setRound(13);
  const { unmount: u3 } = render(<DisputeKanban />);
  const challengeAt13 = columnOfCard() === "challenge";
  u3();

  // Round 15+: finalized.
  setRound(15);
  const { unmount: u4 } = render(<DisputeKanban />);
  const finalizedAt15 = columnOfCard() === "finalized";
  u4();

  setRound(20);
  render(<DisputeKanban />);
  const card = screen.getByTestId("dispute-card-1");
  const finalizedAt20 =
    columnOfCard() === "finalized" &&
    card.getAttribute("data-status") === "finalized_rejected";

  const disputeCardColumnCorrect =
    mappingSane &&
    emptyBefore &&
    provisionalAt12 &&
    challengeAt13 &&
    finalizedAt15 &&
    finalizedAt20;

  // Stake half of the SD7 print (CD8 pattern: one file carries the full
  // spec line). Recomputed from mock events, not re-typed.
  const balances = computeStakeBalances(CLIENT_DIDS, STAKE_EVENTS);
  const stakeTableCorrect =
    balances["did:example:client-3"] === 75 &&
    CLIENT_DIDS.filter((d) => d !== "did:example:client-3").every(
      (d) => balances[d] === 100,
    );

  const allCorrect = stakeTableCorrect && disputeCardColumnCorrect;

  console.log(
    `[SD7] stake_table_correct=${stakeTableCorrect} dispute_card_column_correct=${disputeCardColumnCorrect}`,
  );
  console.log(`[SD7] STATUS=${allCorrect ? "PASS" : "FAIL"}`);
  console.log(
    "[SD7] manual_check_needed=confirm the Kanban card's column transition animation is smooth, not jarring",
  );

  expect(disputeCardColumnCorrect).toBe(true);
  expect(stakeTableCorrect).toBe(true);
});
