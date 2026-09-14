import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { PassportEntry } from "../types/schemas";
import { PASSPORT_ENTRIES } from "../mock/roundFeed";
import DeviceLookup, { filterByDevice } from "./DeviceLookup";
import PassportSubmissions from "./PassportSubmissions";

vi.mock("../mock/useRoundFeed", () => ({
  useRoundFeed: () => ({
    currentRound: 20,
    currentStage: "idle",
    isPlaying: false,
    suspicionHistory: [],
    checkpoints: [],
    stakeEvents: [],
    passportEntries: PASSPORT_ENTRIES,
    fleetScoresThisRound: [],
    imagesExamined: [],
    anomaliesDetected: [],
  }),
}));

const OTHER_DEVICE: PassportEntry = {
  ...PASSPORT_ENTRIES[0],
  device_id: "device-9",
  event_type: "inspection",
};

it("filters by device id case-insensitively and shows an empty state", () => {
  // Pure-function check with two distinct devices proves "only matching"
  // semantics (the mock feed itself only contains device-7).
  const mixed = [...PASSPORT_ENTRIES, OTHER_DEVICE];
  const filtered = filterByDevice(mixed, "device-7");
  const pureFilterCorrect =
    filtered.length === PASSPORT_ENTRIES.length &&
    filtered.every((e) => e.device_id === "device-7") &&
    filterByDevice(mixed, "DEVICE-7").length === PASSPORT_ENTRIES.length &&
    filterByDevice(mixed, "device").length === mixed.length &&
    filterByDevice(mixed, "").length === mixed.length;

  render(<DeviceLookup />);
  const input = screen.getByTestId("device-search-input");

  // Case-insensitive substring match: uppercase query still finds device-7.
  fireEvent.change(input, { target: { value: "DEVICE-7" } });
  const results = screen.getByTestId("device-results");
  const resultRows = within(results).getAllByTestId("passport-row");
  const searchFiltersCorrect =
    pureFilterCorrect &&
    resultRows.length === PASSPORT_ENTRIES.length &&
    resultRows.every((r) => r.getAttribute("data-device-id") === "device-7");

  // Non-matching query → empty state, no results list.
  fireEvent.change(input, { target: { value: "zzz-no-such-device" } });
  const emptyState = screen.queryByTestId("device-empty-state");
  const resultsGone = screen.queryByTestId("device-results") == null;
  const emptyStateShown = emptyState != null && resultsGone;

  // Submissions list (same hook data) renders every mock entry.
  render(<PassportSubmissions />);
  const submissionsRenderCorrect =
    screen.getAllByTestId("passport-row").length >= PASSPORT_ENTRIES.length;

  const allCorrect =
    submissionsRenderCorrect && searchFiltersCorrect && emptyStateShown;

  console.log(
    `[CD8] submissions_render_correct=${submissionsRenderCorrect} search_filters_correct=${searchFiltersCorrect} empty_state_shown=${emptyStateShown}`,
  );
  console.log(`[CD8] STATUS=${allCorrect ? "PASS" : "FAIL"}`);

  expect(searchFiltersCorrect).toBe(true);
  expect(emptyStateShown).toBe(true);
  expect(submissionsRenderCorrect).toBe(true);
});
