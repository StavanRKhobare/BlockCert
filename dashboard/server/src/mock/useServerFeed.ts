// The ONLY sanctioned data source for every panel in this epic.
// Panels must call useServerFeed() — never import serverFeed.ts directly —
// so replacing this hook's internals with real gateway polling later
// requires no changes to any consuming component.
import { createContext, createElement, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  CHECKPOINTS,
  CLIENT_DIDS,
  DISPUTES,
  DISPUTE_ROUNDS,
  DRIFT_EVENTS,
  DRIFT_EVENT_ROUND,
  STAGE_DURATION_MS,
  STAKE_EVENTS,
  SUSPICION_SCORES,
  SYSTEM_STAGE_ORDER,
  TOTAL_ROUNDS,
  TRANSACTIONS,
  TRANSACTION_ROUNDS,
} from "./serverFeed";
import type {
  Checkpoint,
  Dispute,
  DriftEvent,
  StakeEvent,
  SuspicionScore,
  SystemStage,
  TransactionRecord,
} from "../types/schemas";

// "idle" is the rest state between cycles. SystemStage itself has no idle
// member (SD1), so the hook widens the type — same pattern as CD2, where
// the idle state is a feed concern, not a backend stage.
export type ServerStage = SystemStage | "idle";

export interface ServerFeed {
  currentRound: number;
  currentStage: ServerStage;
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  reset: () => void;
  step: () => void;
  clientDids: string[];
  suspicionScores: SuspicionScore[];
  checkpoints: Checkpoint[];
  stakeEvents: StakeEvent[];
  disputes: Dispute[];
  transactions: TransactionRecord[];
  driftEvents: DriftEvent[];
}

export function useServerFeedState(): ServerFeed {
  // stageIdx -1 = "idle" (rest state between cycles).
  const [progress, setProgress] = useState({ round: 0, stageIdx: -1 });
  const [isPlaying, setIsPlaying] = useState(false);

  // Advance exactly one stage. Completing a full cycle (broadcasting ->
  // idle) increments the round. No-op once the whole scenario finished.
  const step = useCallback(() => {
    setProgress((prev) => {
      if (prev.round >= TOTAL_ROUNDS && prev.stageIdx === -1) return prev;
      const next = prev.stageIdx + 1;
      if (next >= SYSTEM_STAGE_ORDER.length) {
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

  const currentStage: ServerStage =
    progress.stageIdx === -1 ? "idle" : SYSTEM_STAGE_ORDER[progress.stageIdx];

  return {
    currentRound: progress.round,
    currentStage,
    isPlaying,
    play,
    pause,
    reset,
    step,
    clientDids: CLIENT_DIDS,
    // Only completed rounds are exposed — panels show data "as of now,"
    // never the future scenario.
    suspicionScores: SUSPICION_SCORES.filter(
      (s) => s.round_number <= progress.round,
    ),
    checkpoints: CHECKPOINTS.slice(0, progress.round),
    stakeEvents: STAKE_EVENTS.filter(
      (e) => (e.round_number ?? 1) <= progress.round,
    ),
    disputes: DISPUTES.filter((_, i) => DISPUTE_ROUNDS[i] <= progress.round),
    transactions: TRANSACTIONS.filter(
      (_, i) => TRANSACTION_ROUNDS[i] <= progress.round,
    ),
    driftEvents: DRIFT_EVENTS.filter(
      () => DRIFT_EVENT_ROUND <= progress.round,
    ),
  };
}

// Shared feed for the assembled app (SD11): one state object in context so
// play/pause/step/reset move every panel together. Outside a provider
// (unit tests, isolated renders) useServerFeed() falls back to local state.
const ServerFeedContext = createContext<ServerFeed | null>(null);

export function ServerFeedProvider({ children }: { children: ReactNode }) {
  const feed = useServerFeedState();
  return createElement(ServerFeedContext.Provider, { value: feed }, children);
}

export function useServerFeed(): ServerFeed {
  const shared = useContext(ServerFeedContext);
  // Always mounted (hook order stays stable); the local feed idles when a
  // shared feed is returned instead.
  const local = useServerFeedState();
  return shared ?? local;
}
