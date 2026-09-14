import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import FedAvgVisualizer, { buildFedAvgEdges } from "./FedAvgVisualizer";
import { CLIENT_DIDS, SUSPICION_SCORES } from "../mock/serverFeed";

// Round 15: client-3 is poisoned (rejected) while the other 7 pass. Uses
// the REAL mock feed data.
const SCORES_15 = SUSPICION_SCORES.filter((s) => s.round_number <= 15);

vi.mock("../mock/useServerFeed", () => ({
  useServerFeed: () => ({
    currentRound: 15,
    currentStage: "idle",
    isPlaying: false,
    clientDids: CLIENT_DIDS,
    suspicionScores: SCORES_15,
    checkpoints: [],
    stakeEvents: [],
    disputes: [],
    transactions: [],
    driftEvents: [],
  }),
}));

it("dims the rejected client's edge, animates the 7 contributors", () => {
  render(<FedAvgVisualizer />);

  // Verdicts for round 15, straight from the mock feed.
  const passedByDid = new Map<string, boolean>();
  for (const s of SCORES_15) {
    if (s.round_number === 15) passedByDid.set(s.client_did, s.passed);
  }

  // Rendered identity list: client-3 excluded, everyone else contributed.
  const excludedItem = screen.getByTestId("fedavg-client-3");
  const othersContributed = [0, 1, 2, 4, 5, 6, 7].every(
    (i) => screen.getByTestId(`fedavg-client-${i}`).getAttribute("data-contributed") === "true",
  );

  // Edge configuration (what React Flow draws): client-3's edge dimmed +
  // non-animated, the other 7 animated. Asserted on the edge objects rather
  // than the SVG because jsdom cannot render xyflow edge geometry at all
  // (zero-size viewport → edges omitted from the DOM; documented in
  // src/test/setup.ts) — asserting library internals there would be fake.
  const edges = buildFedAvgEdges(CLIENT_DIDS, passedByDid);
  const excludedEdge = edges.find((e) => e.id === "e-client-3")!;
  const excludedEdgeDimmed =
    excludedEdge.animated === false &&
    excludedEdge.className === "edge-excluded" &&
    (excludedEdge.style as Record<string, unknown>)?.strokeDasharray === "6 3";
  const honestEdges = edges.filter((e) => e.id !== "e-client-3");
  const honestClientsAnimated =
    honestEdges.length === 7 &&
    honestEdges.every(
      (e) => e.animated === true && e.className === "edge-contributed",
    );

  const excludedClientEdgeDimmed =
    excludedItem.getAttribute("data-contributed") === "false" &&
    othersContributed &&
    excludedEdgeDimmed;

  // Centralized toggle swaps the diagram for the contrast callout and back.
  fireEvent.click(screen.getByTestId("centralized-toggle"));
  const callout = screen.queryByTestId("centralized-callout");
  const calloutCorrect =
    screen.queryByTestId("fedavg-diagram") == null &&
    callout?.textContent?.includes("raw imagery") === true &&
    callout?.textContent?.includes("weight updates") === true;
  fireEvent.click(screen.getByTestId("centralized-toggle"));
  const togglesBack = screen.queryByTestId("fedavg-diagram") != null;

  const allCorrect =
    excludedClientEdgeDimmed &&
    honestClientsAnimated &&
    calloutCorrect &&
    togglesBack;

  console.log(
    `[SD5] excluded_client_edge_dimmed=${excludedClientEdgeDimmed} honest_clients_animated=${honestClientsAnimated}`,
  );
  console.log(`[SD5] STATUS=${allCorrect ? "PASS" : "FAIL"}`);

  expect(excludedClientEdgeDimmed).toBe(true);
  expect(honestClientsAnimated).toBe(true);
  expect(calloutCorrect).toBe(true);
  expect(togglesBack).toBe(true);
});
