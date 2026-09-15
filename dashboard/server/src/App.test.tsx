import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "./App.tsx";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it("assembles every SD3-SD10 panel; play/pause drive the shared round", () => {
  render(<App />);

  // Every panel from SD3-SD10 plus the SD11 chrome is in the DOM.
  const panelIds = [
    "system-map",
    "suspicion-heatmap",
    "fedavg-visualizer",
    "drift-monitor-gate",
    "checkpoint-chain-graph",
    "blockchain-explorer",
    "dispute-kanban",
    "staking-economics",
    "provenance-ledger",
    "attribution-placeholder",
    "legend",
    "teacher-mode-toggle",
    "control-play",
    "control-pause",
    "control-step",
    "control-reset",
  ];
  const missing = panelIds.filter(
    (id) => screen.queryByTestId(id) == null,
  );
  const panelsPresent = missing.length === 0;

  // Teacher toggle flips the presentation class on the app root.
  const root = screen.getByTestId("app-root");
  const toggle = screen.getByTestId("teacher-mode-toggle");
  fireEvent.click(toggle);
  const teacherTogglesClass =
    root.classList.contains("teacher-mode") &&
    toggle.getAttribute("aria-checked") === "true";
  fireEvent.click(toggle);
  const allPanelsPresent = panelsPresent && teacherTogglesClass;

  // Play + fake-timer advance of one full stage cycle (8 x 800ms)
  // completes round 1 across the SHARED feed — controls and panels agree.
  expect(screen.getByTestId("current-round").textContent).toBe("0");
  fireEvent.click(screen.getByTestId("control-play"));
  act(() => {
    vi.advanceTimersByTime(8 * 800);
  });
  const roundAfterPlay = screen.getByTestId("current-round").textContent;

  // Pause freezes the round: advancing time further changes nothing.
  fireEvent.click(screen.getByTestId("control-pause"));
  act(() => {
    vi.advanceTimersByTime(8 * 800);
  });
  const roundAfterPause = screen.getByTestId("current-round").textContent;

  // The heatmap (a downstream panel on the same feed) shows round 1.
  const heatmapShowsRound1 =
    screen.getByTestId("suspicion-heatmap").textContent?.includes("1") ?? false;
  const playAdvancesRound =
    roundAfterPlay === "1" &&
    roundAfterPause === "1" &&
    heatmapShowsRound1;

  const allCorrect = allPanelsPresent && playAdvancesRound;

  console.log(
    `[SD11] all_panels_present=${allPanelsPresent} play_advances_round=${playAdvancesRound}`,
  );
  console.log(`[SD11] STATUS=${allCorrect ? "PASS" : "FAIL"}`);

  if (missing.length > 0) {
    throw new Error(`missing panels: ${missing.join(", ")}`);
  }
  expect(teacherTogglesClass).toBe(true);
  expect(playAdvancesRound).toBe(true);
});
