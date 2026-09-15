// useServerFeed: the ONLY sanctioned data source for every panel (SD2 rule
// unchanged) — now polling the REAL gateway instead of stepping local mock
// state. Same exported hook name, same 14-key ServerFeed shape: every
// SD3-SD10 component works with zero changes.
//
// WHAT IS LIVE (read this before assuming more):
//   currentRound / currentStage <- GET /rounds/current (already SystemStage
//                                  vocabulary — passed through, unknown falls
//                                  back to "idle", stated not invented)
//   isPlaying                  <- GET /rounds/autonomous/status
//   play()  -> POST /rounds/autonomous/start {"interval_seconds": 5}
//   pause() -> POST /rounds/autonomous/stop
//   step()  -> POST /rounds/step
//   reset() -> honest no-op (see below)
//   clientDids     <- GET /clients (chain DIDs, did:bfa:...)
//   transactions   <- GET /blockchain/transactions (gateway record shape is
//                     field-identical to TransactionRecord — passed through)
//   passportEntries <- GET /passport/all (real entries for session-known
//                      devices; unindexed by round — see below)
// WHAT IS *NOT* LIVE — STOP-AND-SAY GAPS (ground rules): the gateway
// exposes NO per-client SuspicionScores, NO checkpoint list, NO stake
// events, and NO dispute series (summaries carry totals only). Those four
// arrays therefore remain served from the deterministic local replay
// (serverFeed.ts), sliced by the LIVE currentRound so panels fill as real
// rounds complete. This is mock data indexed by a live counter — NOT live
// measurements — and stays clearly labeled as such until the gateway gains
// score/checkpoint/stake/dispute endpoints (concrete follow-up).
// WHAT STAYS SYNTHETIC BY REQUIREMENT: the round-17 DriftEvent. The real
// drift monitor still cannot trigger on placeholder reference accuracy
// (G8 limitations endpoint) — the injection below preserves SD6's only
// demonstrable content, explicitly flagged, never presented as measured.
// Nothing here invents a backend field.
import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  CHECKPOINTS,
  DISPUTES,
  DISPUTE_ROUNDS,
  DRIFT_EVENTS,
  DRIFT_EVENT_ROUND,
  STAKE_EVENTS,
  SUSPICION_SCORES,
  TOTAL_ROUNDS,
} from "./serverFeed";
import type {
  Checkpoint,
  Dispute,
  DriftEvent,
  PassportEntry,
  StakeEvent,
  SuspicionScore,
  SystemStage,
  TransactionRecord,
} from "../types/schemas";

// Gateway base URL: VITE_GATEWAY_URL from .env, default http://localhost:8000
// (uvicorn's default serve port for this repo's gateway).
export const GATEWAY_URL: string =
  import.meta.env.VITE_GATEWAY_URL ?? "http://localhost:8000";

export const POLL_INTERVAL_MS = 1000;
const AUTONOMOUS_INTERVAL_SECONDS = 5.0;

// "idle" is the rest state between cycles. SystemStage itself has no idle
// member (SD1), so the hook widens the type — same pattern as CD2, where
// the idle state is a feed concern, not a backend stage.
export type ServerStage = SystemStage | "idle";

const KNOWN_STAGES: ServerStage[] = [
  "idle",
  "collecting_updates",
  "authenticating_all",
  "aggregating",
  "checkpointing",
  "anchoring_chain",
  "drift_monitoring",
  "broadcasting",
];

export function mapGatewayStage(stage: string): ServerStage {
  return (KNOWN_STAGES as string[]).includes(stage)
    ? (stage as ServerStage)
    : "idle";
}

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
  // SD9: system-wide passport submissions (live via GET /passport/all —
  // unindexed by round, unlike the replay arrays below).
  passportEntries: PassportEntry[];
  // G11 provenance discriminator (ADDITIVE — the 14 keys above are
  // byte-identical to SD2's shape): which layers are live vs replayed.
  dataSource: "live-controls + mock-replay-data";
}

interface RoundsCurrent {
  current_round: number;
  current_stage: string;
}

interface ClientRow {
  did: string;
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

export function useServerFeedState(): ServerFeed {
  const [currentRound, setCurrentRound] = useState(0);
  const [currentStage, setCurrentStage] = useState<ServerStage>("idle");
  const [isPlaying, setIsPlaying] = useState(false);
  const [clientDids, setClientDids] = useState<string[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [passportEntries, setPassportEntries] = useState<PassportEntry[]>([]);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const poll = useCallback(async () => {
    try {
      const [current, status, clients, txs, passports] = await Promise.all([
        getJson("/rounds/current") as Promise<RoundsCurrent>,
        getJson("/rounds/autonomous/status") as Promise<{ running: boolean }>,
        getJson("/clients") as Promise<ClientRow[]>,
        getJson("/blockchain/transactions") as Promise<TransactionRecord[]>,
        getJson("/passport/all") as Promise<PassportEntry[]>,
      ]);
      if (!mounted.current) return;
      setCurrentRound(Math.min(Math.max(current.current_round, 0), TOTAL_ROUNDS));
      setCurrentStage(mapGatewayStage(current.current_stage));
      setIsPlaying(status.running);
      setClientDids(clients.map((c) => c.did));
      setTransactions(txs);
      setPassportEntries(passports);
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

  // Mock replay indexed by the LIVE round (see header for why) + the
  // still-synthetic drift injection (round 17+, explicitly required).
  const round = Math.min(currentRound, TOTAL_ROUNDS);
  return {
    currentRound,
    currentStage,
    isPlaying,
    play,
    pause,
    reset,
    step,
    clientDids,
    suspicionScores: SUSPICION_SCORES.filter((s) => s.round_number <= round),
    checkpoints: CHECKPOINTS.slice(0, round),
    stakeEvents: STAKE_EVENTS.filter((e) => (e.round_number ?? 1) <= round),
    disputes: DISPUTES.filter((_, i) => DISPUTE_ROUNDS[i] <= round),
    transactions,
    driftEvents: DRIFT_EVENTS.filter(() => DRIFT_EVENT_ROUND <= round),
    passportEntries,
    dataSource: "live-controls + mock-replay-data",
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
  // Always mounted (hook order stays stable); the local feed's poll loop
  // is cheap (1s cadence, last-known state) when a shared feed is
  // returned instead.
  const local = useServerFeedState();
  return shared ?? local;
}
