import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { STAGE_ORDER } from "../mock/roundFeed";
import PipelineFlowchart from "./PipelineFlowchart";

// Controllable stand-in for useRoundFeed: the component under test reads
// ONLY currentStage/currentRound from the hook (hook itself is covered by
// CD2's own test), so the mock drives it through a stage walk that mirrors
// the real step() semantics without needing the real timer.
const { feedState } = vi.hoisted(() => ({
  feedState: {
    currentRound: 1,
    currentStage: "local_training" as string,
    isPlaying: false,
  },
}));

vi.mock("../mock/useRoundFeed", () => ({
  useRoundFeed: () => feedState,
}));

function testStep() {
  const idx = STAGE_ORDER.indexOf(feedState.currentStage as never);
  if (idx === STAGE_ORDER.length - 1) {
    feedState.currentStage = "idle";
    feedState.currentRound += 1;
  } else {
    feedState.currentStage = STAGE_ORDER[idx + 1];
  }
}

it("highlights the current stage node and marks the previous one completed", () => {
  feedState.currentRound = 1;
  feedState.currentStage = "local_training";
  const { rerender } = render(<PipelineFlowchart />);

  // "Step a few times" through the real stage order: local_training ->
  // computing_embeddings -> authenticating.
  testStep();
  testStep();
  rerender(<PipelineFlowchart />);
  expect(feedState.currentStage).toBe("authenticating");

  const active = screen.getByTestId("stage-node-authenticating");
  const previous = screen.getByTestId("stage-node-computing_embeddings");
  const upcoming = screen.getByTestId("stage-node-broadcasting");

  const correctNodeHighlighted =
    active.getAttribute("data-status") === "active" &&
    active.classList.contains("stage-active") &&
    active.getAttribute("title") !== null &&
    active.getAttribute("title")!.length > 0 &&
    previous.getAttribute("data-status") === "completed" &&
    previous.classList.contains("stage-completed") &&
    !previous.classList.contains("stage-active") &&
    upcoming.getAttribute("data-status") === "upcoming" &&
    !upcoming.classList.contains("stage-active");

  console.log(`[CD3] correct_node_highlighted=${correctNodeHighlighted}`);
  console.log(`[CD3] STATUS=${correctNodeHighlighted ? "PASS" : "FAIL"}`);
  console.log(
    "[CD3] manual_check_needed=confirm the pulse animation reads as 'active' at a glance, not distracting",
  );

  expect(correctNodeHighlighted).toBe(true);
});
