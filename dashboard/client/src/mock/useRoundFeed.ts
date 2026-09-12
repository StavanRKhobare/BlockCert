// The ONLY sanctioned data source for every panel in this epic.
// Panels must call useRoundFeed() — never import roundFeed.ts directly —
// so replacing this hook's internals with real gateway polling later
// requires no changes to any consuming component.
import { useCallback, useEffect, useState } from "react";
import {
  CHECKPOINTS,
  PASSPORT_ENTRIES,
  PASSPORT_ENTRY_ROUNDS,
  STAGE_DURATION_MS,
  STAGE_ORDER,
  STAKE_EVENTS,
  SUSPICION_HISTORY,
  TOTAL_ROUNDS,
} from "./roundFeed";
import type {
  Checkpoint,
  PassportEntry,
  RoundPipelineStage,
  StakeEvent,
  SuspicionScore,
} from "../types/schemas";

export interface RoundFeed {
  currentRound: number;
  currentStage: RoundPipelineStage;
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  reset: () => void;
  step: () => void;
  suspicionHistory: SuspicionScore[];
  checkpoints: Checkpoint[];
  stakeEvents: StakeEvent[];
  passportEntries: PassportEntry[];
}

export function useRoundFeed(): RoundFeed {
  // stageIdx -1 = "idle" (rest state between cycles).
  const [progress, setProgress] = useState({ round: 0, stageIdx: -1 });
  const [isPlaying, setIsPlaying] = useState(false);

  // Advance exactly one stage. Completing a full cycle (broadcasting ->
  // idle) increments the round. No-op once the whole scenario finished.
  const step = useCallback(() => {
    setProgress((prev) => {
      if (prev.round >= TOTAL_ROUNDS && prev.stageIdx === -1) return prev;
      const next = prev.stageIdx + 1;
      if (next >= STAGE_ORDER.length) {
        return {
          round: Math.min(prev.round + 1, TOTAL_ROUNDS),
          stageIdx: -1,
        };
      }
      return { round: prev.round, stageIdx: next };
    });
  }, []);

  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);
  const reset = useCallback(() => {
    setIsPlaying(false);
    setProgress({ round: 0, stageIdx: -1 });
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(step, STAGE_DURATION_MS);
    return () => clearInterval(timer);
  }, [isPlaying, step]);

  const currentStage: RoundPipelineStage =
    progress.stageIdx === -1 ? "idle" : STAGE_ORDER[progress.stageIdx];

  return {
    currentRound: progress.round,
    currentStage,
    isPlaying,
    play,
    pause,
    reset,
    step,
    // Only completed rounds are exposed — panels show data "as of now,"
    // never the future scenario.
    suspicionHistory: SUSPICION_HISTORY.slice(0, progress.round),
    checkpoints: CHECKPOINTS.slice(0, progress.round),
    stakeEvents: STAKE_EVENTS.filter(
      (e) => (e.round_number ?? 1) <= progress.round,
    ),
    passportEntries: PASSPORT_ENTRIES.filter(
      (_, i) => PASSPORT_ENTRY_ROUNDS[i] <= progress.round,
    ),
  };
}
