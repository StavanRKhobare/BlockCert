import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "./App.tsx";

// G10: the hook polls the gateway via fetch — mocked here (same documented
// choice as useRoundFeed.test.ts: fast unit test, no running gateway).
const { feedState } = vi.hoisted(() => ({
  feedState: { round: 0, stage: "idle", running: false },
}));

function reply(payload: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(payload) };
}

beforeEach(() => {
  vi.useFakeTimers();
  feedState.round = 0;
  feedState.stage = "idle";
  feedState.running = false;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, _init?: RequestInit) => {
      if (url.endsWith("/rounds/current"))
        return Promise.resolve(
          reply({ current_round: feedState.round, current_stage: feedState.stage }),
        );
      if (url.endsWith("/rounds/autonomous/status"))
        return Promise.resolve(reply({ running: feedState.running }));
      if (url.endsWith("/rounds/autonomous/start")) {
        feedState.running = true;
        return Promise.resolve(reply({ running: true }));
      }
      if (url.endsWith("/rounds/autonomous/stop")) {
        feedState.running = false;
        return Promise.resolve(reply({ running: false }));
      }
      if (url.endsWith("/rounds/step")) {
        feedState.round += 1;
        feedState.stage = "idle";
        return Promise.resolve(reply({ round: feedState.round }));
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("assembles every CD3-CD8 panel; play advances the shared round", async () => {
  render(<App />);
  // Let the initial poll resolve.
  await act(async () => undefined);

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

  // Play hits the gateway, then the 1s poll picks up the new round across
  // the SHARED feed — controls and panels agree.
  expect(screen.getByTestId("current-round").textContent).toBe("0");
  fireEvent.click(screen.getByTestId("control-play"));
  feedState.round = 1;
  feedState.stage = "idle";
  await act(async () => {
    vi.advanceTimersByTime(1100);
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
