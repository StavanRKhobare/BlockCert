import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  mapGatewayStage,
  useServerFeed,
  type ServerFeed,
} from "./useServerFeed";

// G11 choice (same documented option as G10): fetch is MOCKED — fast unit
// test, no running gateway. Live-gateway coverage lives in gateway/tests.
interface MockReply {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

const LIVE_DIDS = Array.from({ length: 8 }, (_, i) => ({
  did: `did:bfa:client-${i}`,
}));

const LIVE_TXS = [
  {
    tx_hash: `0x${"aa".repeat(32)}`,
    block_number: 1000101,
    gas_used: 92341,
    function_called: "anchorCheckpoint",
    contract_name: "CheckpointAnchor",
    timestamp: 1726000605,
  },
];

const LIVE_PASSPORTS = [
  {
    device_id: "device-7",
    event_type: "repair",
    evidence_hash: "b1f5",
    model_version_hash: "deadbeef",
    actor_did: "did:bfa:client-3",
    signature: "0xsig",
    timestamp: 1726000000,
  },
];

function mockFeed(currentRound: number, currentStage: string, running: boolean) {
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
      if (url.endsWith("/rounds/current"))
        return Promise.resolve(
          reply({ current_round: currentRound, current_stage: currentStage }),
        );
      if (url.endsWith("/rounds/autonomous/status"))
        return Promise.resolve(reply({ running }));
      if (url.endsWith("/clients")) return Promise.resolve(reply(LIVE_DIDS));
      if (url.endsWith("/blockchain/transactions"))
        return Promise.resolve(reply(LIVE_TXS));
      if (url.endsWith("/passport/all"))
        return Promise.resolve(reply(LIVE_PASSPORTS));
      if (url.endsWith("/rounds/autonomous/start"))
        return Promise.resolve(reply({ running: true }));
      if (url.endsWith("/rounds/autonomous/stop"))
        return Promise.resolve(reply({ running: false }));
      if (url.endsWith("/rounds/step"))
        return Promise.resolve(reply({ round: currentRound }));
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("polls the gateway: live round/stage/dids/txs/passports, replay slices", async () => {
  mockFeed(5, "authenticating_all", true);
  const { result, unmount } = renderHook(() => useServerFeed());

  await waitFor(() => {
    expect(result.current.currentRound).toBe(5);
  });
  // Gateway speaks SystemStage already — passed through, not remapped.
  expect(result.current.currentStage).toBe("authenticating_all");
  expect(result.current.isPlaying).toBe(true);
  expect(result.current.clientDids).toHaveLength(8);
  expect(result.current.clientDids[3]).toBe("did:bfa:client-3");
  // Gateway transaction shape is field-identical — passed through.
  expect(result.current.transactions).toHaveLength(1);
  expect(result.current.transactions[0].function_called).toBe("anchorCheckpoint");
  // System-wide ledger entries flow through unindexed by round.
  expect(result.current.passportEntries).toHaveLength(1);
  // Replay arrays slice by the LIVE round (8 clients x 5 rounds).
  expect(result.current.suspicionScores).toHaveLength(40);
  expect(result.current.checkpoints).toHaveLength(5);
  // Synthetic drift stays absent below round 17.
  expect(result.current.driftEvents).toHaveLength(0);
  expect(result.current.dataSource).toBe("live-controls + mock-replay-data");
  unmount();
});

it("keeps the synthetic drift injection at 17+ and maps stages", async () => {
  const mappingCorrect =
    mapGatewayStage("drift_monitoring") === "drift_monitoring" &&
    mapGatewayStage("anchoring_chain") === "anchoring_chain" &&
    mapGatewayStage("idle") === "idle" &&
    mapGatewayStage("nonsense") === "idle";

  mockFeed(16, "idle", false);
  const first = renderHook(() => useServerFeed());
  await waitFor(() => {
    expect(first.result.current.currentRound).toBe(16);
  });
  const hiddenAt16 = first.result.current.driftEvents.length === 0;
  first.unmount();

  mockFeed(17, "idle", false);
  const second = renderHook(() => useServerFeed());
  await waitFor(() => {
    expect(second.result.current.currentRound).toBe(17);
  });
  const shownAt17 =
    second.result.current.driftEvents.length === 1 &&
    second.result.current.driftEvents[0].window_end_round === 17;
  second.unmount();

  const syntheticDriftEventStillPresent = hiddenAt16 && shownAt17 && mappingCorrect;

  console.log(`[SD-G11] synthetic_drift_event_still_present=${syntheticDriftEventStillPresent}`);

  expect(syntheticDriftEventStillPresent).toBe(true);
});

it("drives play/pause/step against the gateway and warns on reset", async () => {
  const calls = mockFeed(2, "idle", false);
  const { result, unmount } = renderHook(() => useServerFeed());
  await waitFor(() => {
    expect(result.current.currentRound).toBe(2);
  });

  await act(async () => {
    result.current.play();
  });
  const playCall = calls.find((c) => c.url.endsWith("/rounds/autonomous/start"));
  const playCorrect =
    playCall !== undefined && (playCall.init?.body as string)?.includes("interval_seconds");

  await act(async () => {
    result.current.pause();
  });
  const pauseCorrect = calls.some((c) => c.url.endsWith("/rounds/autonomous/stop"));

  await act(async () => {
    result.current.step();
  });
  const stepCorrect = calls.some((c) => c.url.endsWith("/rounds/step"));

  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  result.current.reset();
  const resetWarnsHonestly =
    warn.mock.calls.length === 1 &&
    warn.mock.calls[0][0] ===
      "reset() has no effect against live gateway data — restart the gateway process to reset";
  warn.mockRestore();

  unmount();

  expect(playCorrect && pauseCorrect && stepCorrect && resetWarnsHonestly).toBe(true);
});

it("preserves the exact 14-key ServerFeed shape downstream panels use", async () => {
  mockFeed(3, "broadcasting", false);
  const { result, unmount } = renderHook(() => useServerFeed());
  await waitFor(() => {
    expect(result.current.currentRound).toBe(3);
  });
  const feed: ServerFeed = result.current;

  const shapeUnchanged =
    typeof feed.currentRound === "number" &&
    typeof feed.currentStage === "string" &&
    typeof feed.isPlaying === "boolean" &&
    typeof feed.play === "function" &&
    typeof feed.pause === "function" &&
    typeof feed.reset === "function" &&
    typeof feed.step === "function" &&
    Array.isArray(feed.clientDids) &&
    Array.isArray(feed.suspicionScores) &&
    Array.isArray(feed.checkpoints) &&
    Array.isArray(feed.stakeEvents) &&
    Array.isArray(feed.disputes) &&
    Array.isArray(feed.transactions) &&
    Array.isArray(feed.driftEvents) &&
    Array.isArray(feed.passportEntries) &&
    feed.currentStage === "broadcasting";
  unmount();

  console.log(`[SD-G11] shape_unchanged=${shapeUnchanged}`);

  expect(shapeUnchanged).toBe(true);
});
