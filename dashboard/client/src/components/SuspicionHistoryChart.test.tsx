import { fireEvent, render, screen } from "@testing-library/react";
import { cloneElement, isValidElement, type ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { SUSPICION_HISTORY } from "../mock/roundFeed";
import SuspicionHistoryChart from "./SuspicionHistoryChart";

// ResponsiveContainer measures its DOM parent, which is 0x0 in jsdom, so
// the SVG (and its dots) never renders there. Replicate its contract —
// clone the child chart with concrete dimensions — at a fixed test size.
// Production code stays fully responsive; this seam exists only in jsdom.
vi.mock("recharts", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) =>
      isValidElement(children)
        ? cloneElement(
            children as React.ReactElement<Record<string, unknown>>,
            { width: 640, height: 256 },
          )
        : children,
  };
});

// Past the attacker-activation point (round 12): 15 completed rounds, the
// last 4 poisoned. Uses the REAL mock feed data so the breakdown assertions
// below check exact backend values, not re-typed copies.
const HISTORY_15 = SUSPICION_HISTORY.slice(0, 15);

vi.mock("../mock/useRoundFeed", () => ({
  useRoundFeed: () => ({
    currentRound: 15,
    currentStage: "idle",
    isPlaying: false,
    suspicionHistory: HISTORY_15,
    checkpoints: [],
    stakeEvents: [],
    passportEntries: [],
  }),
}));

function fmt(n: number) {
  return n.toFixed(4);
}

it("plots one point per round and expands the clicked round's breakdown", () => {
  const { container } = render(<SuspicionHistoryChart />);

  const dots = container.querySelectorAll("circle.score-dot");
  const pointCountCorrect = dots.length === 15;

  // Click round 13 (poisoned) — breakdown must show ITS exact values.
  const dot13 = screen.getByTestId("score-dot-13");
  fireEvent.click(dot13);
  const expected13 = HISTORY_15[12];
  const panel13 = screen.getByTestId("breakdown-round-13");
  const round13Correct =
    panel13.textContent?.includes(fmt(expected13.outlier_fraction)) === true &&
    panel13.textContent?.includes(fmt(expected13.mean_shift)) === true &&
    panel13.textContent?.includes(fmt(expected13.micro_cluster_score)) === true &&
    panel13.textContent?.includes(fmt(expected13.combined_score)) === true;

  // Click round 15 (also poisoned, different values) — panel must switch.
  const dot15 = screen.getByTestId("score-dot-15");
  fireEvent.click(dot15);
  const expected15 = HISTORY_15[14];
  const panel15 = screen.getByTestId("breakdown-round-15");
  const round15Correct =
    panel15.textContent?.includes(fmt(expected15.outlier_fraction)) === true &&
    panel15.textContent?.includes(fmt(expected15.mean_shift)) === true &&
    panel15.textContent?.includes(fmt(expected15.micro_cluster_score)) === true &&
    panel15.textContent?.includes(fmt(expected15.combined_score)) === true &&
    // values genuinely differ between rounds 13 and 15 — guards against a
    // panel that renders stale/constant numbers.
    fmt(expected13.combined_score) !== fmt(expected15.combined_score);

  const clickExpandCorrect = round13Correct && round15Correct;

  console.log(
    `[CD4] point_count_correct=${pointCountCorrect} click_expand_correct=${clickExpandCorrect}`,
  );
  console.log(
    `[CD4] STATUS=${pointCountCorrect && clickExpandCorrect ? "PASS" : "FAIL"}`,
  );

  expect(pointCountCorrect).toBe(true);
  expect(clickExpandCorrect).toBe(true);
});
