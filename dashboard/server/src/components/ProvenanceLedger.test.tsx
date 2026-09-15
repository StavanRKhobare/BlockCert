import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import ProvenanceLedger from "./ProvenanceLedger";
import { PASSPORT_ENTRIES } from "../mock/serverFeed";

// Round 20: all 5 entries visible, spanning 3 devices. Uses the REAL mock
// feed data.
vi.mock("../mock/useServerFeed", () => ({
  useServerFeed: () => ({
    currentRound: 20,
    currentStage: "idle",
    isPlaying: false,
    clientDids: [],
    suspicionScores: [],
    checkpoints: [],
    stakeEvents: [],
    disputes: [],
    transactions: [],
    driftEvents: [],
    passportEntries: PASSPORT_ENTRIES,
  }),
}));

it("aggregates entries across multiple devices, newest first", () => {
  render(<ProvenanceLedger />);

  const rows = screen.getAllByTestId("provenance-row");
  const deviceIds = new Set(rows.map((r) => r.getAttribute("data-device-id")));

  // Genuinely multi-device: more than one distinct device_id, and every
  // mock entry rendered (unlike CD8's single-device filtered search).
  const multiDeviceFeedCorrect =
    rows.length === PASSPORT_ENTRIES.length &&
    deviceIds.size >= 2 &&
    deviceIds.has("device-7") &&
    [...deviceIds].every((id) =>
      PASSPORT_ENTRIES.some((e) => e.device_id === id),
    );

  // Most recent first: first row is the round-18 device-21 resale, last
  // row is the round-4 device-7 repair.
  const first = rows[0];
  const last = rows[rows.length - 1];
  const orderCorrect =
    first.getAttribute("data-device-id") === "device-21" &&
    last.getAttribute("data-device-id") === "device-7" &&
    last.getAttribute("data-event-type") === "repair";

  // Rows carry the required fields: device, type, actor, truncated hash
  // with the full value behind the title.
  const fieldsCorrect = rows.every(
    (r) =>
      (r.textContent?.includes("client-") ?? false) &&
      r.querySelector("[title^='0x'], [title^='b1f5'], [title^='02bd'], [title^='8fa2']") != null,
  );

  const allCorrect = multiDeviceFeedCorrect && orderCorrect && fieldsCorrect;

  console.log(`[SD9] multi_device_feed_correct=${multiDeviceFeedCorrect && orderCorrect}`);
  console.log(`[SD9] STATUS=${allCorrect ? "PASS" : "FAIL"}`);

  expect(multiDeviceFeedCorrect).toBe(true);
  expect(orderCorrect).toBe(true);
  expect(fieldsCorrect).toBe(true);
});
