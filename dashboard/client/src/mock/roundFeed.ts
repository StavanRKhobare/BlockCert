// Deterministic, pre-generated 20-round mock scenario for ONE client —
// did:example:client-3, mirroring fl-orchestrator's own C5 test scenario
// (8 clients, attacker injected at round 12, rounds 1-11 all-honest).
//
// NUMBER PROVENANCE (nothing here is invented):
// - Honest tuples: measured directly from the real auth-service pipeline
//   (compute_reference_stats + B2 scoring + B4 combiner + B4.5 calibrated
//   threshold 9.981717382468954) for make_clients(8) with seeds 0-7.
//   Combined scores span 7.7806-9.3716 (the honest band), all passed=true
//   since max_honest 9.7005 < threshold 9.9817 (Story B4.5 assertion).
//   11 honest rounds reuse these 8 measured tuples in fixed cyclic order.
// - Poisoned tuples: measured the same way from MockModelAdapter(...)
//   .embed(poisoned=True) for attacker seeds 48,51,61,63,69,72,73,76,78.
//   Combined scores span 25.4851-26.3912 (the ~25-26 spike band), all
//   passed=false since every value exceeds the 9.98 threshold.
// - reference_set_accuracy_delta is 0.0 throughout because the real
//   backend wires 0.0 there too (Story B5: B3 not wired in yet — gateway's
//   job once golden labeled images exist with the vision model).
// - weights_hash values are sha256("blockfededauth-r-mock-checkpoint-
//   round-<n>"), precomputed offline; parent_hash chains round-to-round
//   exactly like Story D2.5's real behavior; is_delta=false throughout per
//   that story's design (delta-chain replay deliberately deferred).
// - evidence_hash values are sha256("blockfededauth-r-mock-<tag>").
// - reference_set_metrics accuracy (0.94 flat, then 0.93-0.85 decline) and
//   ai_prediction values are illustrative mock dressing, NOT measured —
//   the real backend has no such per-round series yet.
// - PassportEntry.signature values are "0xmock-..." placeholders; real
//   DID/signature enforcement is deferred to gateway (batch-2 scoping).
//
// No component may import this module directly — every panel reads
// scenario data only through useRoundFeed() (the single swap point for
// real gateway polling later).
import type {
  Checkpoint,
  PassportEntry,
  RoundPipelineStage,
  StakeEvent,
  SuspicionScore,
} from "../types/schemas";

export const CLIENT_DID = "did:example:client-3";

// Measured in Story B4.5 (test_calibration.py): 9.981717382468954.
export const CALIBRATED_THRESHOLD = 9.9817;

export const TOTAL_ROUNDS = 20;
export const ATTACK_START_ROUND = 12;

// The stage sequence this client cycles through EVERY round. "idle" is the
// rest state between cycles, not part of the cycle itself: one full cycle
// is idle -> 7 stages -> idle, i.e. 8 step() calls per round (user decision
// on CD2 spec's "9 times" wording — 7 active stages + idle admit only 8
// transitions; see useRoundFeed.step).
export const STAGE_ORDER: RoundPipelineStage[] = [
  "local_training",
  "computing_embeddings",
  "authenticating",
  "aggregating",
  "checkpointing",
  "drift_check",
  "broadcasting",
];

export const STAGE_DURATION_MS = 800;

interface ScoreTuple {
  outlier_fraction: number;
  mean_shift: number;
  micro_cluster_score: number;
  combined_score: number;
}

// Measured honest tuples (client-0..client-7 order, seeds 0-7).
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

// Measured poisoned tuples (attacker seeds 48,51,61,63,69,72,73,76,78).
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

function buildSuspicionHistory(): SuspicionScore[] {
  const out: SuspicionScore[] = [];
  for (let round = 1; round <= TOTAL_ROUNDS; round++) {
    const honest = round < ATTACK_START_ROUND;
    const tuple = honest
      ? HONEST_TUPLES[(round - 1) % HONEST_TUPLES.length]
      : POISONED_TUPLES[round - ATTACK_START_ROUND];
    out.push({
      client_did: CLIENT_DID,
      round_number: round,
      outlier_fraction: tuple.outlier_fraction,
      mean_shift: tuple.mean_shift,
      micro_cluster_score: tuple.micro_cluster_score,
      reference_set_accuracy_delta: 0.0,
      combined_score: tuple.combined_score,
      passed: tuple.combined_score < CALIBRATED_THRESHOLD,
    });
  }
  return out;
}

export const SUSPICION_HISTORY: SuspicionScore[] = buildSuspicionHistory();

// sha256("blockfededauth-r-mock-checkpoint-round-<n>"), precomputed offline.
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

// Illustrative mock accuracy series (NOT measured): stable 0.94 while
// honest, declining 0.93 -> 0.85 once the attack starts at round 12.
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
  {
    client_did: CLIENT_DID,
    event_type: "staked",
    amount: 100.0,
    reason: "initial stake on registration",
    round_number: 1,
  },
  {
    client_did: CLIENT_DID,
    event_type: "slashed",
    amount: 25.0,
    reason:
      "failed authentication at round 12 (combined_score 26.37 > calibrated_threshold 9.98)",
    round_number: ATTACK_START_ROUND,
  },
];

export const PASSPORT_ENTRIES: PassportEntry[] = [
  {
    device_id: "device-7",
    event_type: "repair",
    evidence_hash:
      "b1f5d4bbc877d620aaa0c3fe4be88b566bcbb9c7cf428eb4410d397d4fe32eed",
    model_version_hash: WEIGHTS_HASHES[3],
    ai_prediction: 0.12,
    actor_did: CLIENT_DID,
    signature: "0xmock-signature-repair-001",
    timestamp: BASE_TIMESTAMP + 4 * ROUND_SECONDS,
  },
  {
    device_id: "device-7",
    event_type: "resale",
    evidence_hash:
      "02bd8b55c657938d20def42764dba8e6613c1a98f140c766e8bf95ded7037e96",
    model_version_hash: WEIGHTS_HASHES[8],
    ai_prediction: 0.08,
    actor_did: CLIENT_DID,
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
    actor_did: CLIENT_DID,
    signature: "0xmock-signature-inspection-003",
    timestamp: BASE_TIMESTAMP + 15 * ROUND_SECONDS,
  },
];

// PassportEntry has no round field (backend type matched exactly), so the
// round each entry was "submitted" in lives here, internal to the mock.
// The hook filters entries on this to preserve the as-of-now replay feel.
export const PASSPORT_ENTRY_ROUNDS: number[] = [4, 9, 15];
