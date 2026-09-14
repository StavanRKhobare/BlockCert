// Server-dashboard mirrors of shared/interfaces/schemas.py — copied
// field-for-field from dashboard-client's Story CD1 (same snake_case field
// names, zero translation layer). Deliberate duplication, not a shared
// package: changing one app never risks breaking the other (same
// philosophy as passport_client.py vs. rollback-service's chain_client.py).
// NOTE: CD1's per-client RoundPipelineStage is intentionally NOT copied —
// this app uses the system-wide SystemStage below instead.

export interface ClientDID {
  did: string;
  public_key: string;
  display_name?: string;
  stake_balance: number;
}

export interface SuspicionScore {
  client_did: string;
  round_number: number;
  outlier_fraction: number;
  mean_shift: number;
  micro_cluster_score: number;
  reference_set_accuracy_delta: number;
  combined_score: number;
  passed: boolean;
}

export type AuthDecision =
  | "accepted"
  | "provisionally_rejected"
  | "finalized_rejected"
  | "overturned";

export interface Checkpoint {
  round_number: number;
  weights_hash: string;
  parent_hash: string | null;
  off_chain_uri: string;
  is_delta: boolean;
  reference_set_metrics: Record<string, unknown>;
  timestamp: number;
}

export interface DriftEvent {
  window_start_round: number;
  window_end_round: number;
  trigger_reason: string;
  reverted_to_checkpoint_hash: string;
}

export interface StakeEvent {
  client_did: string;
  event_type: "staked" | "slashed" | "restored";
  amount: number;
  reason?: string;
  round_number?: number;
}

export interface PassportEntry {
  device_id: string;
  event_type: "repair" | "resale" | "refurbishment" | "recycling" | "inspection";
  evidence_hash: string;
  model_version_hash: string;
  ai_prediction?: number;
  actor_did: string;
  signature: string;
  timestamp: number;
}

// --- Explorer/demo-only types below. NOT mirrored from any backend schema:
// invented for this app's blockchain-explorer / dispute-kanban panels.
// Do not treat these as API contracts without backend support. ---

export interface TransactionRecord {
  tx_hash: string;
  block_number: number;
  gas_used: number;
  function_called: string;
  contract_name: string;
  timestamp: number;
}

export type DisputeStatus =
  | "provisionally_rejected"
  | "challenge_window"
  | "finalized_rejected"
  | "overturned";

export interface Dispute {
  dispute_id: number;
  client_did: string;
  round_number: number;
  reason: string;
  status: DisputeStatus;
  deadline: number;
}

// Frontend-only for now — the system-wide analog of CD1's per-client
// RoundPipelineStage. The real backend does not yet emit granular
// system-stage events; gateway will need to add this later. Flagged here,
// not silently assumed.
export type SystemStage =
  | "collecting_updates"
  | "authenticating_all"
  | "aggregating"
  | "checkpointing"
  | "anchoring_chain"
  | "drift_monitoring"
  | "broadcasting";
