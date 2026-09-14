// The ONLY sanctioned data source for every panel in this epic.
// Panels must call useRoundFeed() — never import roundFeed.ts directly —
// so replacing this hook's internals with real gateway polling later
// requires no changes to any consuming component.
import { createContext, createElement, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  ANOMALIES_DETECTED_PER_ROUND,
  CHECKPOINTS,
  FLEET_HONEST_SCORES,
  IMAGES_EXAMINED_PER_ROUND,
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
  // CD5: the 7 OTHER fleet members' combined scores for the current round
  // (their characteristic honest values — static per client). This client's
  // own score is NOT included here; read it from suspicionHistory's latest
  // entry, so the ranking reacts when this client turns malicious.
  fleetScoresThisRound: number[];
  // CD7: per-round contribution volume, sliced to completed rounds only
  // (placeholder series pending the real vision model — see roundFeed.ts).
  imagesExamined: number[];
  anomaliesDetected: number[];
}

export function useRoundFeedState(): RoundFeed {
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
    fleetScoresThisRound: FLEET_HONEST_SCORES,
    imagesExamined: IMAGES_EXAMINED_PER_ROUND.slice(0, progress.round),
    anomaliesDetected: ANOMALIES_DETECTED_PER_ROUND.slice(0, progress.round),
  };
}

// CD9: shared feed for the assembled app. Every panel calls useRoundFeed()
// with no arguments, so mounting panels side-by-side would otherwise give
// each its own independent round counter (App's play button would advance
// only its own copy). RoundFeedProvider holds ONE state object in context;
// App.tsx wraps all panels + controls in it so play/pause/step/reset move
// every panel together. Outside a provider (unit tests, isolated renders)
// useRoundFeed() falls back to local state — existing behavior unchanged.
const RoundFeedContext = createContext<RoundFeed | null>(null);

export function RoundFeedProvider({ children }: { children: ReactNode }) {
  const feed = useRoundFeedState();
  return createElement(RoundFeedContext.Provider, { value: feed }, children);
}

export function useRoundFeed(): RoundFeed {
  const shared = useContext(RoundFeedContext);
  // Always mounted (hook order stays stable); the local feed idles —
  // its timer only runs while its own isPlaying is true, which never
  // happens when a shared feed is returned instead.
  const local = useRoundFeedState();
  return shared ?? local;
}
