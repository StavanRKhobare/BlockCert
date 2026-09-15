import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import AttributionPlaceholder from "./AttributionPlaceholder";

vi.mock("../mock/useServerFeed", () => ({
  useServerFeed: () => ({
    currentRound: 10,
    currentStage: "idle",
    isPlaying: false,
    clientDids: [],
    suspicionScores: [],
    checkpoints: [],
    stakeEvents: [],
    disputes: [],
    transactions: [],
    driftEvents: [],
    passportEntries: [],
  }),
}));

it("renders the coming-soon label with zero interactive elements", () => {
  const { container } = render(<AttributionPlaceholder />);

  const placeholderRenders =
    screen.queryByTestId("attribution-placeholder") != null &&
    screen
      .getByTestId("attribution-placeholder")
      .textContent?.includes("Culprit Attribution — coming soon") === true;

  // No buttons, links, inputs, selects, textareas, or ARIA buttons —
  // nothing clickable, focusable-for-action, or editable.
  const interactive = container.querySelectorAll(
    "button, a, input, select, textarea, [role='button'], [onclick]",
  );
  const noInteractiveElements = interactive.length === 0;

  const allCorrect = placeholderRenders && noInteractiveElements;

  console.log(
    `[SD10] placeholder_renders=${placeholderRenders} no_interactive_elements=${noInteractiveElements}`,
  );
  console.log(`[SD10] STATUS=${allCorrect ? "PASS" : "FAIL"}`);

  expect(placeholderRenders).toBe(true);
  expect(noInteractiveElements).toBe(true);
});
