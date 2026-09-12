// TypeScript mirrors of shared/interfaces/schemas.py — field names kept in
// Python's snake_case as-is so a future real API response maps onto these
// types with zero translation layer. Do not rename fields to camelCase.

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

// Frontend-only for now — the real backend does not yet emit granular
// pipeline-stage events; gateway will need to add this later. Flagged
// here, not silently assumed.
export type RoundPipelineStage =
  | "idle"
  | "local_training"
  | "computing_embeddings"
  | "authenticating"
  | "aggregating"
  | "checkpointing"
  | "drift_check"
  | "broadcasting";
