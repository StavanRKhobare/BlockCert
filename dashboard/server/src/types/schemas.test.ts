// Compile-time-only check: TypeScript itself is the test here. One valid
// object literal per interface, assigned to a typed const. If this file
// compiles under `npx tsc --noEmit`, the shapes are self-consistent.
// (The single trivial runtime test below exists only because Vitest fails
// a *.test.ts file that contains zero tests; it asserts nothing about the
// types — tsc is the real check for this story.)
import { expect, it } from "vitest";
import type {
  AuthDecision,
  Checkpoint,
  ClientDID,
  Dispute,
  DisputeStatus,
  DriftEvent,
  PassportEntry,
  StakeEvent,
  SuspicionScore,
  SystemStage,
  TransactionRecord,
} from "./schemas";

const clientDID: ClientDID = {
  did: "did:example:client-3",
  public_key: "0xabc",
  display_name: "Client 3",
  stake_balance: 100.0,
};

const suspicionScore: SuspicionScore = {
  client_did: "did:example:client-3",
  round_number: 1,
  outlier_fraction: 1.0,
  mean_shift: 7.1647,
  micro_cluster_score: 0.1379,
  reference_set_accuracy_delta: 0.0,
  combined_score: 9.3716,
  passed: true,
};

const authDecision: AuthDecision = "provisionally_rejected";

const checkpoint: Checkpoint = {
  round_number: 1,
  weights_hash: "deadbeef",
  parent_hash: null,
  off_chain_uri: "local://checkpoints/round-1/deadbeef.npz",
  is_delta: false,
  reference_set_metrics: { reference_set_accuracy: 0.94 },
  timestamp: 1726000000,
};

const driftEvent: DriftEvent = {
  window_start_round: 12,
  window_end_round: 16,
  trigger_reason: "sustained suspicion + accuracy decline over window",
  reverted_to_checkpoint_hash: "deadbeef",
};

const stakeEvent: StakeEvent = {
  client_did: "did:example:client-3",
  event_type: "slashed",
  amount: 25.0,
  reason: "failed authentication",
  round_number: 12,
};

const passportEntry: PassportEntry = {
  device_id: "device-001",
  event_type: "repair",
  evidence_hash: "cafef00d",
  model_version_hash: "deadbeef",
  ai_prediction: 0.12,
  actor_did: "did:example:client-3",
  signature: "0xsig",
  timestamp: 1726000000,
};

// Explorer/demo-only types (no backend mirror — see schemas.ts).
const transactionRecord: TransactionRecord = {
  tx_hash: "0xabc123",
  block_number: 42,
  gas_used: 21000,
  function_called: "anchorCheckpoint",
  contract_name: "CheckpointAnchor",
  timestamp: 1726000000,
};

const disputeStatus: DisputeStatus = "challenge_window";

const dispute: Dispute = {
  dispute_id: 1,
  client_did: "did:example:client-3",
  round_number: 12,
  reason: "combined_score 26.37 > calibrated_threshold 9.98",
  status: "challenge_window",
  deadline: 1726000000,
};

const systemStage: SystemStage = "authenticating_all";

void clientDID;
void suspicionScore;
void authDecision;
void checkpoint;
void driftEvent;
void stakeEvent;
void passportEntry;
void transactionRecord;
void disputeStatus;
void dispute;
void systemStage;

it("type shapes are self-consistent (real check is tsc --noEmit)", () => {
  expect(true).toBe(true);
});
