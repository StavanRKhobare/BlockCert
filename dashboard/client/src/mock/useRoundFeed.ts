// useRoundFeed: the ONLY sanctioned data source for every panel (CD2 rule
// unchanged) — now polling the REAL gateway instead of stepping local mock
// state. Same exported hook name, same 12-key RoundFeed shape: every
// CD3-CD9 component works with zero changes.
//
// WHAT IS LIVE (read this before assuming more):
//   currentRound / currentStage <- GET /rounds/current (stage mapped below)
//   isPlaying                  <- GET /rounds/autonomous/status
//   play()  -> POST /rounds/autonomous/start {"interval_seconds": 5}
//   pause() -> POST /rounds/autonomous/stop
//   step()  -> POST /rounds/step
//   reset() -> honest no-op (see below)
// WHAT IS *NOT* LIVE — STOP-AND-SAY GAP (ground rules): the gateway
// exposes NO per-client SuspicionScores, NO checkpoint list, NO stake
// events, NO per-client passport entries, NO fleet scores, and NO volume
// series (verified against gateway/routers/*.py — /rounds/history carries
// totals-only summaries). Those seven arrays therefore remain served from
// the deterministic local replay (roundFeed.ts), sliced by the LIVE
// currentRound so panels fill as real rounds complete. This is mock data
// indexed by a live counter — NOT live measurements — and stays clearly
// labeled as such until the gateway gains score/checkpoint/stake
// endpoints (concrete follow-up, not a vague "later"). Nothing here
// invents a backend field: unmapped stages fall back to "idle", and the
// replay arrays keep their original mock identities (did:example:...).
import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ANOMALIES_DETECTED_PER_ROUND,
  CHECKPOINTS,
  FLEET_HONEST_SCORES,
  IMAGES_EXAMINED_PER_ROUND,
  PASSPORT_ENTRIES,
  PASSPORT_ENTRY_ROUNDS,
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

// Gateway base URL: VITE_GATEWAY_URL from .env, default http://localhost:8000
// (uvicorn's default serve port for this repo's gateway).
export const GATEWAY_URL: string =
  import.meta.env.VITE_GATEWAY_URL ?? "http://localhost:8000";

export const POLL_INTERVAL_MS = 1000;
const AUTONOMOUS_INTERVAL_SECONDS = 5.0;

// Gateway (system-wide) stage -> client pipeline stage. The gateway drives
// rounds, not per-client training, so local_training/computing_embeddings
// never occur live (that work happens opaquely inside run_round), and the
// gateway's collecting_updates/anchoring_chain stages are never emitted by
// step_round either. Unmapped values fall back to "idle" — stated, not
// invented.
const STAGE_MAP: Record<string, RoundPipelineStage> = {
  idle: "idle",
  authenticating_all: "authenticating",
  aggregating: "aggregating",
  checkpointing: "checkpointing",
  drift_monitoring: "drift_check",
  broadcasting: "broadcasting",
};

export function mapGatewayStage(stage: string): RoundPipelineStage {
  return STAGE_MAP[stage] ?? "idle";
}

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
  // G10 provenance discriminator (ADDITIVE — the 12 keys above are
  // byte-identical to CD2's shape): which layers are live vs replayed.
  dataSource: "live-controls + mock-replay-data";
}

async function getJson(path: string): Promise<unknown> {
  const response = await fetch(`${GATEWAY_URL}${path}`);
  if (!response.ok) {
    throw new Error(`GET ${path} -> ${response.status}`);
  }
  return response.json() as Promise<unknown>;
}

async function postJson(path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(`${GATEWAY_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`POST ${path} -> ${response.status}`);
  }
  return response.json() as Promise<unknown>;
}

export function useRoundFeedState(
  // Configured client identity for the (future) per-client filtering;
  // default is the gateway's chain DID for client-3. Unused against live
  // data TODAY (no per-client endpoint exists — see header), kept so call
  // sites don't change when filtering lands.
  _clientDid = "did:bfa:client-3",
): RoundFeed {
  const [currentRound, setCurrentRound] = useState(0);
  const [currentStage, setCurrentStage] = useState<RoundPipelineStage>("idle");
  const [isPlaying, setIsPlaying] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const poll = useCallback(async () => {
    try {
      const [current, status] = await Promise.all([
        getJson("/rounds/current") as Promise<{
          current_round: number;
          current_stage: string;
        }>,
        getJson("/rounds/autonomous/status") as Promise<{
          running: boolean;
        }>,
      ]);
      if (!mounted.current) return;
      setCurrentRound(
        Math.min(Math.max(current.current_round, 0), TOTAL_ROUNDS),
      );
      setCurrentStage(mapGatewayStage(current.current_stage));
      setIsPlaying(status.running);
    } catch {
      // Gateway down: keep last-known state; the next tick retries.
      // Never blank the dashboard on a transient poll failure.
    }
  }, []);

  useEffect(() => {
    void poll();
    const timer = setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [poll]);

  const play = useCallback(() => {
    setIsPlaying(true); // optimistic; the poll confirms from the server
    void postJson("/rounds/autonomous/start", {
      interval_seconds: AUTONOMOUS_INTERVAL_SECONDS,
    }).catch(() => {
      if (mounted.current) setIsPlaying(false);
    });
  }, []);

  const pause = useCallback(() => {
    setIsPlaying(false); // optimistic; the poll confirms from the server
    void postJson("/rounds/autonomous/stop").catch(() => {
      if (mounted.current) setIsPlaying(true);
    });
  }, []);

  const step = useCallback(() => {
    // Fire-and-forget: the next 1s poll picks up the new round/stage.
    void postJson("/rounds/step").catch(() => undefined);
  }, []);

  const reset = useCallback(() => {
    // Honest no-op: real on-chain/session state cannot be rewound from
    // here. A silent no-op would be worse than this warning.
    console.warn(
      "reset() has no effect against live gateway data — restart the gateway process to reset",
    );
  }, []);

  return {
    currentRound,
    currentStage,
    isPlaying,
    play,
    pause,
    reset,
    step,
    // Mock replay indexed by the LIVE round (see header for why).
    suspicionHistory: SUSPICION_HISTORY.slice(0, currentRound),
    checkpoints: CHECKPOINTS.slice(0, currentRound),
    stakeEvents: STAKE_EVENTS.filter(
      (e) => (e.round_number ?? 1) <= currentRound,
    ),
    passportEntries: PASSPORT_ENTRIES.filter(
      (_, i) => PASSPORT_ENTRY_ROUNDS[i] <= currentRound,
    ),
    fleetScoresThisRound: FLEET_HONEST_SCORES,
    imagesExamined: IMAGES_EXAMINED_PER_ROUND.slice(0, currentRound),
    anomaliesDetected: ANOMALIES_DETECTED_PER_ROUND.slice(0, currentRound),
    dataSource: "live-controls + mock-replay-data",
  };
}

// CD9: shared feed for the assembled app. Every panel calls useRoundFeed()
// with no arguments, so mounting panels side-by-side would otherwise give
// each its own poll loop. RoundFeedProvider holds ONE feed in context;
// App.tsx wraps all panels + controls in it. Outside a provider (unit
// tests, isolated renders) useRoundFeed() falls back to a local feed.
const RoundFeedContext = createContext<RoundFeed | null>(null);

export function RoundFeedProvider({ children }: { children: ReactNode }) {
  const feed = useRoundFeedState();
  return createElement(RoundFeedContext.Provider, { value: feed }, children);
}

export function useRoundFeed(): RoundFeed {
  const shared = useContext(RoundFeedContext);
  // Always mounted (hook order stays stable); the local feed's poll loop
  // is cheap (1s cadence, last-known state) when a shared feed is
  // returned instead.
  const local = useRoundFeedState();
  return shared ?? local;
}
