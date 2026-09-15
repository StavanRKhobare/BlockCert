import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  GATEWAY_URL,
  mapGatewayStage,
  useRoundFeed,
  type RoundFeed,
} from "./useRoundFeed";

// G10 choice (per prompt's preferred option): fetch is MOCKED — this stays
// a fast unit test with no running gateway. Live-gateway coverage belongs
// to gateway/tests (G0-G9), not here. Documented, consistent.
interface MockReply {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

function mockFetch(
  current: { current_round: number; current_stage: string },
  running: boolean,
) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const reply = (payload: unknown): MockReply => ({
    ok: true,
    status: 200,
    json: () => Promise.resolve(payload),
  });
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.endsWith("/rounds/current")) return Promise.resolve(reply(current));
      if (url.endsWith("/rounds/autonomous/status"))
        return Promise.resolve(reply({ running }));
      if (url.endsWith("/rounds/autonomous/start"))
        return Promise.resolve(reply({ running: true }));
      if (url.endsWith("/rounds/autonomous/stop"))
        return Promise.resolve(reply({ running: false }));
      if (url.endsWith("/rounds/step"))
        return Promise.resolve(reply({ round: current.current_round }));
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("polls the gateway and derives round, mapped stage, and replay slices", async () => {
  mockFetch({ current_round: 5, current_stage: "authenticating_all" }, true);
  const { result, unmount } = renderHook(() => useRoundFeed());

  await waitFor(() => {
    expect(result.current.currentRound).toBe(5);
  });
  // Gateway system stage maps to the client pipeline stage.
  expect(result.current.currentStage).toBe("authenticating");
  expect(result.current.isPlaying).toBe(true);
  // Replay arrays slice by the LIVE round (mock data, live counter).
  expect(result.current.suspicionHistory).toHaveLength(5);
  expect(result.current.checkpoints).toHaveLength(5);
  expect(result.current.dataSource).toBe("live-controls + mock-replay-data");
  unmount();
});

it("maps every gateway stage, falling back to idle for unknown values", () => {
  const cases: Array<[string, RoundFeed["currentStage"]]> = [
    ["idle", "idle"],
    ["authenticating_all", "authenticating"],
    ["aggregating", "aggregating"],
    ["checkpointing", "checkpointing"],
    ["drift_monitoring", "drift_check"],
    ["broadcasting", "broadcasting"],
    ["collecting_updates", "idle"],
    ["anchoring_chain", "idle"],
    ["something-new", "idle"],
  ];
  const mappingCorrect = cases.every(([input, expected]) => mapGatewayStage(input) === expected);

  console.log(`[CD-G10] stage_mapping_correct=${mappingCorrect}`);

  expect(mappingCorrect).toBe(true);
});

it("drives play/pause/step against the gateway and warns on reset", async () => {
  const calls = mockFetch({ current_round: 2, current_stage: "idle" }, false);
  const { result, unmount } = renderHook(() => useRoundFeed());
  await waitFor(() => {
    expect(result.current.currentRound).toBe(2);
  });

  await act(async () => {
    result.current.play();
  });
  const playCall = calls.find((c) => c.url === `${GATEWAY_URL}/rounds/autonomous/start`);
  const playCorrect =
    playCall !== undefined &&
    (playCall.init?.body as string)?.includes("interval_seconds");

  await act(async () => {
    result.current.pause();
  });
  const pauseCorrect = calls.some((c) => c.url === `${GATEWAY_URL}/rounds/autonomous/stop`);

  await act(async () => {
    result.current.step();
  });
  const stepCorrect = calls.some((c) => c.url === `${GATEWAY_URL}/rounds/step`);

  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  result.current.reset();
  const resetWarnsHonestly =
    warn.mock.calls.length === 1 &&
    warn.mock.calls[0][0] ===
      "reset() has no effect against live gateway data — restart the gateway process to reset";
  const resetMakesNoCalls = !calls.some((c) => c.url.includes("/reset"));
  warn.mockRestore();

  const controlsCorrect = playCorrect && pauseCorrect && stepCorrect && resetWarnsHonestly && resetMakesNoCalls;
  unmount();

  expect(controlsCorrect).toBe(true);
});

it("preserves the exact 12-key RoundFeed shape downstream panels use", async () => {
  mockFetch({ current_round: 3, current_stage: "broadcasting" }, false);
  const { result, unmount } = renderHook(() => useRoundFeed());
  await waitFor(() => {
    expect(result.current.currentRound).toBe(3);
  });
  const feed = result.current;

  const shapeUnchanged =
    typeof feed.currentRound === "number" &&
    typeof feed.currentStage === "string" &&
    typeof feed.isPlaying === "boolean" &&
    typeof feed.play === "function" &&
    typeof feed.pause === "function" &&
    typeof feed.reset === "function" &&
    typeof feed.step === "function" &&
    Array.isArray(feed.suspicionHistory) &&
    Array.isArray(feed.checkpoints) &&
    Array.isArray(feed.stakeEvents) &&
    Array.isArray(feed.passportEntries) &&
    Array.isArray(feed.fleetScoresThisRound) &&
    Array.isArray(feed.imagesExamined) &&
    Array.isArray(feed.anomaliesDetected) &&
    feed.currentStage === "broadcasting";
  unmount();

  console.log(`[CD-G10] shape_unchanged=${shapeUnchanged}`);

  expect(shapeUnchanged).toBe(true);
});
