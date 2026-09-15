// Server-wide deterministic 20-round, 8-client mock scenario — the SAME
// scenario as Epic CD's roundFeed.ts, from the server's vantage point (all
// 8 clients' scores per round, not just client-3's).
//
// NUMBER PROVENANCE (copied from CD, not regenerated):
// - Honest tuples + poisoned tuples + CALIBRATED_THRESHOLD (9.9817...) are
//   verbatim copies of dashboard-client's measured auth-pipeline values
//   (Story B4.5; see client roundFeed.ts provenance notes). Client-3's own
//   per-round combined scores here are IDENTICAL to the client's
//   SUSPICION_HISTORY, so both dashboards tell the same story side by side.
//   NOTE on the SD spec's parenthetical honest-band list ([8.9265, 7.7989,
//   ...]): those values are NOT what Story CD5 used — CD5's build log
//   records them as non-reproducing, and the client app runs on the measured
//   [8.7462, 7.5985, 8.4854, 9.3716, 7.7873, 7.7806, 9.1614, 8.3007] band.
//   Consistency (the actual requirement) means copying CD5's real numbers,
//   which is what this file does.
// - Checkpoint hashes, parent chaining, is_delta=false, reference-accuracy
//   series, base timestamps: verbatim copies of the client's chain.
// - Client-3's staked@1 / slashed@12 events: verbatim copies (same amounts,
//   reasons, rounds). The OTHER 7 clients' staked@1 events are structural
//   mock filler (uniform 100.0) — the backend has no such per-client series
//   yet; flagged here, not silently assumed.
// - TransactionRecord hashes/gas/block numbers: fabricated demo identifiers
//   (deterministic, NOT measured) — fine, this panel is a blockchain
//   explorer illustration, and the type itself is explorer-only (SD1).
// - The ONE DriftEvent is // SYNTHETIC for dashboard demo purposes only —
//   the real DriftMonitor (Story D3) has never triggered: reference-set
//   accuracy is still _PLACEHOLDER_ACCURACY = 0.9, flat, so its
//   AND-condition can never fire (documented, expected, not a bug).
//   Remove/replace once real accuracy data exists. SD6's UI copy must label
//   it as a stand-in, never as measured system behavior.
//
// No component may import this module directly — every panel reads scenario
// data only through useServerFeed() (the single swap point for real
// gateway polling later).
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

export const CLIENT_DIDS: string[] = [
  "did:example:client-0",
  "did:example:client-1",
  "did:example:client-2",
  "did:example:client-3",
  "did:example:client-4",
  "did:example:client-5",
  "did:example:client-6",
  "did:example:client-7",
];

export const ATTACK_CLIENT_DID = "did:example:client-3";
const ATTACK_CLIENT_INDEX = 3;

// Measured in Story B4.5 (test_calibration.py): 9.981717382468954.
export const CALIBRATED_THRESHOLD = 9.9817;

export const TOTAL_ROUNDS = 20;
export const ATTACK_START_ROUND = 12;

// The system-wide stage cycle, one full pass per round. "idle" is the rest
// state between cycles (not in this list): idle -> 7 stages -> idle, i.e.
// 8 step() calls per round — same fixed-duration pattern as CD's per-client
// cycle (see CD2's note on the "9 times" wording).
export const SYSTEM_STAGE_ORDER: SystemStage[] = [
  "collecting_updates",
  "authenticating_all",
  "aggregating",
  "checkpointing",
  "anchoring_chain",
  "drift_monitoring",
  "broadcasting",
];

export const STAGE_DURATION_MS = 800;

interface ScoreTuple {
  outlier_fraction: number;
  mean_shift: number;
  micro_cluster_score: number;
  combined_score: number;
}

// Measured honest tuples, one per client index (seeds 0-7) — verbatim CD.
const HONEST_TUPLES: ScoreTuple[] = [
  { outlier_fraction: 1.0, mean_shift: 6.6017, micro_cluster_score: 0.0964, combined_score: 8.7462 },
  { outlier_fraction: 1.0, mean_shift: 5.4874, micro_cluster_score: 0.0741, combined_score: 7.5985 },
  { outlier_fraction: 1.0, mean_shift: 6.2785, micro_cluster_score: 0.1379, combined_score: 8.4854 },
  { outlier_fraction: 1.0, mean_shift: 7.1647, micro_cluster_score: 0.1379, combined_score: 9.3716 },
  { outlier_fraction: 1.0, mean_shift: 5.6428, micro_cluster_score: 0.0964, combined_score: 7.7873 },
  { outlier_fraction: 1.0, mean_shift: 5.5963, micro_cluster_score: 0.1228, combined_score: 7.7806 },
  { outlier_fraction: 1.0, mean_shift: 7.025, micro_cluster_score: 0.0909, combined_score: 9.1614 },
  { outlier_fraction: 1.0, mean_shift: 6.0938, micro_cluster_score: 0.1379, combined_score: 8.3007 },
];

// Measured poisoned tuples (attacker seeds 48,51,61,63,69,72,73,76,78) —
// verbatim CD. Client-3's rounds 12-20 use these in order, so its scores
// here match the client dashboard's SuspicionHistoryChart exactly.
const POISONED_TUPLES: ScoreTuple[] = [
  { outlier_fraction: 1.0, mean_shift: 22.8651, micro_cluster_score: 1.0, combined_score: 26.3651 },
  { outlier_fraction: 1.0, mean_shift: 22.1932, micro_cluster_score: 1.0, combined_score: 25.6932 },
  { outlier_fraction: 1.0, mean_shift: 22.0053, micro_cluster_score: 1.0, combined_score: 25.5053 },
  { outlier_fraction: 1.0, mean_shift: 22.8912, micro_cluster_score: 1.0, combined_score: 26.3912 },
  { outlier_fraction: 1.0, mean_shift: 22.2183, micro_cluster_score: 1.0, combined_score: 25.7183 },
  { outlier_fraction: 1.0, mean_shift: 22.8239, micro_cluster_score: 1.0, combined_score: 26.3239 },
  { outlier_fraction: 1.0, mean_shift: 21.9851, micro_cluster_score: 1.0, combined_score: 25.4851 },
  { outlier_fraction: 1.0, mean_shift: 22.8348, micro_cluster_score: 1.0, combined_score: 26.3348 },
  { outlier_fraction: 1.0, mean_shift: 22.8783, micro_cluster_score: 1.0, combined_score: 26.3783 },
];

function buildSuspicionScores(): SuspicionScore[] {
  const out: SuspicionScore[] = [];
  for (let round = 1; round <= TOTAL_ROUNDS; round++) {
    for (let client = 0; client < CLIENT_DIDS.length; client++) {
      const poisoned =
        client === ATTACK_CLIENT_INDEX && round >= ATTACK_START_ROUND;
      const tuple = poisoned
        ? POISONED_TUPLES[round - ATTACK_START_ROUND]
        : HONEST_TUPLES[client];
      out.push({
        client_did: CLIENT_DIDS[client],
        round_number: round,
        outlier_fraction: tuple.outlier_fraction,
        mean_shift: tuple.mean_shift,
        micro_cluster_score: tuple.micro_cluster_score,
        reference_set_accuracy_delta: 0.0,
        combined_score: tuple.combined_score,
        passed: tuple.combined_score < CALIBRATED_THRESHOLD,
      });
    }
  }
  return out;
}

export const SUSPICION_SCORES: SuspicionScore[] = buildSuspicionScores();

// sha256("blockfededauth-r-mock-checkpoint-round-<n>") — verbatim CD.
const WEIGHTS_HASHES: string[] = [
  "da0536b49220fad6f4c0e97e424d57e68da42b52d085222f8165cc262f6e1412",
  "0896aae1965a7f9c7fb5a4237e187c828050f778eecb2964f9cdc14b0795c918",
  "f4e86780ce8e4ff30c3d25ca36731e9a05a9bdd6e4019ba6f5715dc933819210",
  "286366805ac6c4f420fd2db43411f159a39328653ded8248bd137f23a28314b6",
  "939f36f0ed270a449a90d15c19c741fe984acceea102b662367e59b19c907a58",
  "04497abfb482ac10ebed0db812b28cbff9614f67dbdf8bb675070a2b23f69568",
  "2a73d62765586485953add8b4527c2a21f5445067abeec2320d1e3bd454242d6",
  "2197e0340b8cc66504c8bd0ba50992983674979a2fbd82f170248a61e122eb54",
  "df7a17561dcd493274ee30c3f09ddc008ad197cc5e3b073340d0dcaa3656a0a5",
  "b47062d8b9bda5562dcf6a6548f89e6a81d38d5de3cc98daf6f4d693ad6ee329",
  "a61823138f343f0479aeabe8269592077763ce7faeabd6d1060bb2b68db985fc",
  "8f301bb163444b46d361247fa8839bb75411d200a52ab689080e220c4da23d20",
  "626219913dbc56634db1d66669d5319b2ae36b86338890765f92b17df57e4932",
  "2ea5cb58f6de0583753dfabdbc545c68b02427d039c68e60b46ec7cc5466efd8",
  "202ad3860ebfdc3a2f753c7daffc0d752ea4b2f82b40224e5000c64dfa3b2d45",
  "4b84b171cabccfb760ec0f2b3a9f15c98b06087cebdce405033e9997302b3f5a",
  "27ab5133e899251a85c8fa043281a2d838e3f839175c9213252b2d78d84b649a",
  "699836e1c4cafc5bfc56e9f50ee27574e3a82f97e93824fb6491a03323d51e71",
  "56d08b54f5e516d39ea8327135b3c01723b758367e736a5daba35457be646eab",
  "a41cf388ef6f047f294ded04c8d290d27b0f242b5238545005fe996760766b59",
];

// Illustrative mock accuracy series (NOT measured) — verbatim CD.
const REFERENCE_ACCURACY: number[] = [
  0.94, 0.94, 0.94, 0.94, 0.94, 0.94, 0.94, 0.94, 0.94, 0.94, 0.94,
  0.93, 0.92, 0.91, 0.9, 0.89, 0.88, 0.87, 0.86, 0.85,
];

const BASE_TIMESTAMP = 1726000000;
const ROUND_SECONDS = 600;

function buildCheckpoints(): Checkpoint[] {
  return WEIGHTS_HASHES.map((weights_hash, i) => {
    const round_number = i + 1;
    return {
      round_number,
      weights_hash,
      parent_hash: i === 0 ? null : WEIGHTS_HASHES[i - 1],
      off_chain_uri: `local://checkpoint_data/${weights_hash}.npz`,
      is_delta: false,
      reference_set_metrics: {
        reference_set_accuracy: REFERENCE_ACCURACY[i],
      },
      timestamp: BASE_TIMESTAMP + round_number * ROUND_SECONDS,
    };
  });
}

export const CHECKPOINTS: Checkpoint[] = buildCheckpoints();

export const STAKE_EVENTS: StakeEvent[] = [
  ...CLIENT_DIDS.map((client_did) => ({
    client_did,
    event_type: "staked" as const,
    amount: 100.0,
    reason: "initial stake on registration",
    round_number: 1,
  })),
  // Verbatim CD: client-3 slashed when it first fails at round 12.
  {
    client_did: ATTACK_CLIENT_DID,
    event_type: "slashed",
    amount: 25.0,
    reason:
      "failed authentication at round 12 (combined_score 26.37 > calibrated_threshold 9.98)",
    round_number: ATTACK_START_ROUND,
  },
];

// One dispute for client-3, filed at round 12, progressing through review.
// Stored as status snapshots (same dispute_id); the hook exposes snapshots
// up to currentRound so panels show the dispute "as of now". Dispute flow
// itself is mock structure — the backend has no dispute series yet.
export const DISPUTES: Dispute[] = [
  {
    dispute_id: 1,
    client_did: ATTACK_CLIENT_DID,
    round_number: 12,
    reason: "combined_score 26.37 > calibrated_threshold 9.98 at round 12",
    status: "provisionally_rejected",
    deadline: BASE_TIMESTAMP + 15 * ROUND_SECONDS,
  },
  {
    dispute_id: 1,
    client_did: ATTACK_CLIENT_DID,
    round_number: 12,
    reason: "combined_score 26.37 > calibrated_threshold 9.98 at round 12",
    status: "challenge_window",
    deadline: BASE_TIMESTAMP + 15 * ROUND_SECONDS,
  },
  {
    dispute_id: 1,
    client_did: ATTACK_CLIENT_DID,
    round_number: 12,
    reason: "challenge window elapsed with no exonerating evidence",
    status: "finalized_rejected",
    deadline: BASE_TIMESTAMP + 15 * ROUND_SECONDS,
  },
];

// Dispute has no self-describing status-round (backend type matched for the
// shared fields; status progression is mock structure), so the round each
// snapshot becomes visible lives here, internal to the mock.
export const DISPUTE_ROUNDS: number[] = [12, 13, 15];

// Deterministic demo tx hash (NOT measured — fabricated explorer filler).
// Simple LCG over the index; stable across runs, no randomness.
function demoTxHash(n: number): string {
  let x = 0x9e3779b9 + n * 0x85ebca6b;
  let out = "";
  for (let i = 0; i < 64; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    out += "0123456789abcdef"[x % 16];
  }
  return `0x${out}`;
}

interface TxSpec {
  round: number;
  function_called: string;
  contract_name: string;
  gas_used: number;
}

function buildTransactions(): { txs: TransactionRecord[]; rounds: number[] } {
  const specs: TxSpec[] = [];
  for (let round = 1; round <= TOTAL_ROUNDS; round++) {
    specs.push({
      round,
      function_called: "anchorCheckpoint",
      contract_name: "CheckpointAnchor",
      gas_used: 92341 + ((round * 37) % 5000),
    });
  }
  for (const e of STAKE_EVENTS) {
    specs.push({
      round: e.round_number ?? 1,
      function_called: e.event_type === "slashed" ? "slashForAuthFailure" : "stake",
      contract_name: "Staking",
      gas_used: e.event_type === "slashed" ? 47120 : 44880,
    });
  }
  DISPUTES.forEach((_d, i) => {
    specs.push({
      round: DISPUTE_ROUNDS[i],
      function_called: i === 0 ? "openDispute" : "updateDisputeStatus",
      contract_name: "Dispute",
      gas_used: 52310 + i * 111,
    });
  });
  // Deterministic on-chain order: by round, checkpoint anchors first.
  specs.sort((a, b) => a.round - b.round);
  const txs = specs.map((s, i) => ({
    tx_hash: demoTxHash(i),
    block_number: 1000100 + i,
    gas_used: s.gas_used,
    function_called: s.function_called,
    contract_name: s.contract_name,
    timestamp: BASE_TIMESTAMP + s.round * ROUND_SECONDS + 5,
  }));
  return { txs, rounds: specs.map((s) => s.round) };
}

const BUILT_TXS = buildTransactions();
export const TRANSACTIONS: TransactionRecord[] = BUILT_TXS.txs;
export const TRANSACTION_ROUNDS: number[] = BUILT_TXS.rounds;

// SYNTHETIC for dashboard demo purposes only — the real drift monitor
// cannot yet trigger this given the placeholder reference-set accuracy;
// remove/replace once real accuracy data exists. Window covers the first
// five poisoned rounds; reverts to the last pre-attack anchor (round 11).
export const DRIFT_EVENTS: DriftEvent[] = [
  {
    window_start_round: 13,
    window_end_round: 17,
    trigger_reason:
      "SYNTHETIC demo stand-in: illustrated 5-round suspicion window — not measured system behavior",
    reverted_to_checkpoint_hash: WEIGHTS_HASHES[10],
  },
];
export const DRIFT_EVENT_ROUND = 17;

// System-wide passport submissions (SD9 addition — SD2 scoped the feed to
// chain/auth data; CD7-pattern extension). The 3 device-7 entries are
// verbatim copies of the client app's submissions (same device, hashes,
// rounds, actor) so both dashboards agree side by side; the device-12 and
// device-21 entries are structural mock filler showing OTHER clients'
// devices (the backend has no multi-device series yet — flagged here).
// Evidence hashes for the filler entries reuse the deterministic demo-hash
// helper (fabricated identifiers, like the transaction hashes).
export const PASSPORT_ENTRIES: PassportEntry[] = [
  {
    device_id: "device-7",
    event_type: "repair",
    evidence_hash:
      "b1f5d4bbc877d620aaa0c3fe4be88b566bcbb9c7cf428eb4410d397d4fe32eed",
    model_version_hash: WEIGHTS_HASHES[3],
    ai_prediction: 0.12,
    actor_did: "did:example:client-3",
    signature: "0xmock-signature-repair-001",
    timestamp: BASE_TIMESTAMP + 4 * ROUND_SECONDS,
  },
  {
    device_id: "device-12",
    event_type: "repair",
    evidence_hash: demoTxHash(100),
    model_version_hash: WEIGHTS_HASHES[6],
    ai_prediction: 0.05,
    actor_did: "did:example:client-5",
    signature: "0xmock-signature-repair-004",
    timestamp: BASE_TIMESTAMP + 7 * ROUND_SECONDS,
  },
  {
    device_id: "device-7",
    event_type: "resale",
    evidence_hash:
      "02bd8b55c657938d20def42764dba8e6613c1a98f140c766e8bf95ded7037e96",
    model_version_hash: WEIGHTS_HASHES[8],
    ai_prediction: 0.08,
    actor_did: "did:example:client-3",
    signature: "0xmock-signature-resale-002",
    timestamp: BASE_TIMESTAMP + 9 * ROUND_SECONDS,
  },
  {
    device_id: "device-7",
    event_type: "inspection",
    evidence_hash:
      "8fa2305e4a6166159856bebcf8f608ff3125dc9a1fca2cd66b810c366bfbf825",
    model_version_hash: WEIGHTS_HASHES[14],
    ai_prediction: 0.31,
    actor_did: "did:example:client-3",
    signature: "0xmock-signature-inspection-003",
    timestamp: BASE_TIMESTAMP + 15 * ROUND_SECONDS,
  },
  {
    device_id: "device-21",
    event_type: "resale",
    evidence_hash: demoTxHash(101),
    model_version_hash: WEIGHTS_HASHES[17],
    ai_prediction: 0.19,
    actor_did: "did:example:client-2",
    signature: "0xmock-signature-resale-005",
    timestamp: BASE_TIMESTAMP + 18 * ROUND_SECONDS,
  },
];

// PassportEntry has no round field (backend type matched exactly), so the
// round each entry was "submitted" in lives here, internal to the mock.
export const PASSPORT_ENTRY_ROUNDS: number[] = [4, 7, 9, 15, 18];
