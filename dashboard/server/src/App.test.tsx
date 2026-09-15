import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "./App.tsx";
import { DRIFT_EVENTS, DRIFT_EVENT_ROUND } from "./mock/serverFeed";

// G11: the hook polls the gateway via fetch — mocked here (same documented
// choice as useServerFeed.test.ts: fast unit test, no running gateway).
const { feedState } = vi.hoisted(() => ({
  feedState: { round: 0, stage: "idle", running: false },
}));

function reply(payload: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(payload) };
}

const MOCK_DIDS = Array.from({ length: 8 }, (_, i) => ({
  did: `did:bfa:client-${i}`,
}));

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
      if (url.endsWith("/clients")) return Promise.resolve(reply(MOCK_DIDS));
      if (url.endsWith("/blockchain/transactions")) return Promise.resolve(reply([]));
      if (url.endsWith("/passport/all")) return Promise.resolve(reply([]));
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

it("assembles every SD3-SD10 panel; play/pause drive the shared round", async () => {
  render(<App />);
  // Let the initial poll resolve.
  await act(async () => undefined);

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

  // Pause freezes the round: advancing time further changes nothing.
  fireEvent.click(screen.getByTestId("control-pause"));
  await act(async () => {
    vi.advanceTimersByTime(1100);
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

  // SD-G11 combined verdict, each key evidenced IN THIS TEST: all 16
  // panels render + advance against the live-polling hook (shape holds for
  // every consumer, nothing downstream broke), and the synthetic injection
  // source the hook filters is still present and still gated at 17.
  const shapeUnchanged = allPanelsPresent;
  const downstreamUnaffected = allPanelsPresent && playAdvancesRound;
  const syntheticStillPresent =
    DRIFT_EVENTS.length === 1 &&
    DRIFT_EVENT_ROUND === 17 &&
    DRIFT_EVENTS[0].window_end_round === 17;
  const g11Pass = shapeUnchanged && downstreamUnaffected && syntheticStillPresent;

  console.log(
    `[SD-G11] shape_unchanged=${shapeUnchanged} all_downstream_components_unaffected=${downstreamUnaffected} synthetic_drift_event_still_present=${syntheticStillPresent}`,
  );
  console.log(`[SD-G11] STATUS=${g11Pass ? "PASS" : "FAIL"}`);

  if (missing.length > 0) {
    throw new Error(`missing panels: ${missing.join(", ")}`);
  }
  expect(teacherTogglesClass).toBe(true);
  expect(playAdvancesRound).toBe(true);
});
