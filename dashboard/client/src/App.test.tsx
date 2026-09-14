import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "./App.tsx";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it("assembles every CD3-CD8 panel; play advances the shared round", () => {
  render(<App />);

  // Every panel from CD3-CD8 plus the CD9 chrome is in the DOM.
  const panelIds = [
    "pipeline-flowchart",
    "suspicion-history",
    "fleet-standing",
    "stake-trust-panel",
    "contribution-volume",
    "passport-submissions",
    "device-lookup",
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
  const allPanelsPresent = missing.length === 0;

  // Teacher toggle flips the presentation class on the app root.
  const root = screen.getByTestId("app-root");
  const toggle = screen.getByTestId("teacher-mode-toggle");
  fireEvent.click(toggle);
  const teacherTogglesClass =
    root.classList.contains("teacher-mode") &&
    toggle.getAttribute("aria-checked") === "true";
  fireEvent.click(toggle);

  // Play + fake-timer advance of one full stage cycle (8 x 800ms)
  // completes round 1 across the SHARED feed — controls and panels agree.
  expect(screen.getByTestId("current-round").textContent).toBe("0");
  fireEvent.click(screen.getByTestId("control-play"));
  act(() => {
    vi.advanceTimersByTime(8 * 800);
  });
  const roundAfterPlay = screen.getByTestId("current-round").textContent;
  const suspicionShowsRound1 =
    screen.getByTestId("suspicion-history").textContent?.includes("1") ??
    false;
  const playAdvancesRound =
    roundAfterPlay === "1" && suspicionShowsRound1;

  const allCorrect =
    allPanelsPresent && teacherTogglesClass && playAdvancesRound;

  console.log(
    `[CD9] all_panels_present=${allPanelsPresent && teacherTogglesClass} play_advances_round=${playAdvancesRound}`,
  );
  console.log(`[CD9] STATUS=${allCorrect ? "PASS" : "FAIL"}`);
  console.log(
    "[CD9] manual_check_needed=confirm teacher mode visually reads as a clear presentation layer, not just slightly bigger text",
  );

  if (missing.length > 0) {
    throw new Error(`missing panels: ${missing.join(", ")}`);
  }
  expect(teacherTogglesClass).toBe(true);
  expect(playAdvancesRound).toBe(true);
});
