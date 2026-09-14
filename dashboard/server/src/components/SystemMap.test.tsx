import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import SystemMap, { layerForStage } from "./SystemMap";
import type { ServerStage } from "../mock/useServerFeed";

// Controllable stand-in for useServerFeed: the component under test reads
// ONLY currentStage from the hook (hook itself is covered by SD2's own
// test), so the mock drives it through stages directly.
const { feedState } = vi.hoisted(() => ({
  feedState: {
    currentRound: 5,
    currentStage: "collecting_updates" as ServerStage,
    isPlaying: false,
  },
}));

vi.mock("../mock/useServerFeed", () => ({
  useServerFeed: () => feedState,
}));

const EXPECTED: Array<[ServerStage, string]> = [
  ["collecting_updates", "auth"],
  ["authenticating_all", "auth"],
  ["aggregating", "aggregation"],
  ["checkpointing", "rollback"],
  ["drift_monitoring", "rollback"],
  ["anchoring_chain", "blockchain"],
  ["broadcasting", "aggregation"],
];

it("highlights the architecture layer owning each system stage", () => {
  // Pure mapping first: every stage resolves per the SD3 spec table.
  const mappingCorrect =
    EXPECTED.every(([stage, layer]) => layerForStage(stage) === layer) &&
    layerForStage("idle") === null;

  // Rendered highlight follows the mapping for a sample of stages.
  let renderedCorrect = true;
  for (const [stage, layer] of EXPECTED.slice(1, 5)) {
    feedState.currentStage = stage;
    const { unmount } = render(<SystemMap />);
    const active = screen.getByTestId(`sys-node-${layer}`);
    const othersOk = ["auth", "aggregation", "rollback", "blockchain"]
      .filter((l) => l !== layer)
      .every(
        (l) =>
          screen.getByTestId(`sys-node-${l}`).getAttribute("data-status") !==
          "active",
      );
    const attributionGrayed =
      screen.getByTestId("sys-node-attribution").getAttribute("data-status") ===
      "disabled";
    if (
      active.getAttribute("data-status") !== "active" ||
      !active.classList.contains("sys-active") ||
      !othersOk ||
      !attributionGrayed
    ) {
      renderedCorrect = false;
    }
    unmount();
  }

  // Attribution is non-interactive: clicking selects nothing.
  feedState.currentStage = "aggregating";
  render(<SystemMap />);
  fireEvent.click(screen.getByTestId("sys-node-attribution"));
  const attributionIgnoresClicks =
    screen.queryByTestId("layer-detail-attribution") == null;

  // Clicking a live node expands its inline detail.
  fireEvent.click(screen.getByTestId("sys-node-blockchain"));
  const clickExpands =
    screen.queryByTestId("layer-detail-blockchain") != null;

  const stageToNodeMappingCorrect =
    mappingCorrect && renderedCorrect && attributionIgnoresClicks && clickExpands;

  console.log(`[SD3] stage_to_node_mapping_correct=${stageToNodeMappingCorrect}`);
  console.log(`[SD3] STATUS=${stageToNodeMappingCorrect ? "PASS" : "FAIL"}`);
  console.log(
    "[SD3] manual_check_needed=confirm this reads as the dashboard's visual anchor, not just another panel",
  );

  expect(stageToNodeMappingCorrect).toBe(true);
});
