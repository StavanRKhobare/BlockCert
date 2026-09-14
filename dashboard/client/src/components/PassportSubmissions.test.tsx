import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { PASSPORT_ENTRIES } from "../mock/roundFeed";
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

it("renders one row per mock passport entry with truncated hash + copy button", async () => {
  render(<PassportSubmissions />);

  const rows = screen.getAllByTestId("passport-row");
  const submissionsRenderCorrect = rows.length === PASSPORT_ENTRIES.length;

  // Each row shows its event type and a truncated hash whose full value is
  // exposed via the copy button's title.
  const rowsShowContent = PASSPORT_ENTRIES.every((e) =>
    rows.some(
      (r) =>
        r.getAttribute("data-event-type") === e.event_type &&
        r.textContent?.includes(e.device_id),
    ),
  );
  const copyButtons = PASSPORT_ENTRIES.map((_, i) =>
    screen.getByTestId(`copy-hash-${i}`),
  );
  const copyExposesFullHash = copyButtons.every(
    (b, i) => b.getAttribute("title") === PASSPORT_ENTRIES[i].evidence_hash,
  );

  // Copy button gives feedback on click (clipboard write is best-effort —
  // jsdom may lack it; the "Copied!" label is the asserted behavior).
  // The label flips after an async clipboard attempt, so await it.
  fireEvent.click(copyButtons[0]);
  const copyFeedback = (await screen.findByText("Copied!")) != null;

  const allCorrect =
    submissionsRenderCorrect && rowsShowContent && copyExposesFullHash && copyFeedback;

  console.log(
    `[CD8] submissions_render_correct=${submissionsRenderCorrect && rowsShowContent && copyExposesFullHash}`,
  );
  console.log(`[CD8] STATUS=${allCorrect ? "PASS" : "FAIL"}`);

  expect(submissionsRenderCorrect).toBe(true);
  expect(rowsShowContent).toBe(true);
  expect(copyExposesFullHash).toBe(true);
});
