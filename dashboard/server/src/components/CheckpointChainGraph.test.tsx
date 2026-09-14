import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import CheckpointChainGraph, { buildCheckpointChain } from "./CheckpointChainGraph";
import { buildRoundSignals, evaluateDriftGate } from "./DriftMonitorGate";
import {
  CHECKPOINTS,
  DRIFT_EVENTS,
  DRIFT_EVENT_ROUND,
  SUSPICION_SCORES,
} from "../mock/serverFeed";

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

it("chains checkpoints forward, revert edge only at 17+ to the named anchor", () => {
  // Round 16: 16 nodes, 15 forward parent_hash edges, no revert edge.
  setRound(16);
  const at16 = buildCheckpointChain(feed.checkpoints, feed.driftEvents);
  const noRevertAt16 =
    at16.nodes.length === 16 &&
    at16.edges.filter((e) => e.className === "edge-chain").length === 15 &&
    at16.edges.every((e) => e.className !== "edge-revert");
  const { unmount: u1 } = render(<CheckpointChainGraph />);
  const noNoteAt16 = screen.queryByTestId("chain-synthetic-note") == null;
  u1();

  // Round 17: revert edge appears, latest (R17) back to the hash the
  // synthetic event names (the round-11 anchor), styled distinctly.
  setRound(17);
  const at17 = buildCheckpointChain(feed.checkpoints, feed.driftEvents);
  const revert = at17.edges.filter((e) => e.className === "edge-revert");
  const expectedTarget = `cp-${CHECKPOINTS.find((cp) => cp.weights_hash === DRIFT_EVENTS[0].reverted_to_checkpoint_hash)?.round_number}`;
  const revertEdgeAppearsCorrectly =
    noRevertAt16 &&
    noNoteAt16 &&
    revert.length === 1 &&
    revert[0].source === "cp-17" &&
    revert[0].target === expectedTarget &&
    expectedTarget === "cp-11" &&
    (revert[0].style as Record<string, unknown>)?.strokeDasharray === "8 4" &&
    (revert[0].style as Record<string, unknown>)?.stroke === "#fb7185";

  // Rendered nodes carry the round labels; the stand-in note shows.
  render(<CheckpointChainGraph />);
  const diagramText =
    screen.getByTestId("checkpoint-chain-diagram").textContent ?? "";
  const nodesRendered = diagramText.includes("R11") && diagramText.includes("R17");
  const noteShown =
    screen.queryByTestId("chain-synthetic-note")?.textContent?.includes("stand-in") === true;

  // Gate half of the SD6 print (computed here so the spec's single line
  // carries both keys, CD8 pattern).
  setRound(16);
  const pure16 = evaluateDriftGate(buildRoundSignals(feed.suspicionScores, feed.checkpoints));
  setRound(17);
  const pure17 = evaluateDriftGate(buildRoundSignals(feed.suspicionScores, feed.checkpoints));
  const andGateLogicCorrect =
    pure16.sustainedSuspicion &&
    pure16.accuracyDeclining &&
    pure17.sustainedSuspicion &&
    pure17.accuracyDeclining;

  const allCorrect =
    andGateLogicCorrect && revertEdgeAppearsCorrectly && nodesRendered && noteShown;

  console.log(
    `[SD6] and_gate_logic_correct=${andGateLogicCorrect} revert_edge_appears_correctly=${revertEdgeAppearsCorrectly && nodesRendered && noteShown}`,
  );
  console.log(`[SD6] STATUS=${allCorrect ? "PASS" : "FAIL"}`);

  expect(revertEdgeAppearsCorrectly).toBe(true);
  expect(nodesRendered).toBe(true);
  expect(noteShown).toBe(true);
  expect(andGateLogicCorrect).toBe(true);
});
