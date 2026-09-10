"""
Shared data contracts. Every service imports these instead of redefining its
own versions — this is what lets modules be built and tested independently
and still fit together later without translation glue.
"""

from pydantic import BaseModel
from typing import Optional
from enum import Enum
import time


class ClientDID(BaseModel):
    """A registered participant's decentralized identity."""
    did: str                 # e.g. "did:bfa:client-07"
    public_key: str
    display_name: Optional[str] = None
    stake_balance: float = 0.0


class ClientUpdate(BaseModel):
    """What a client submits at the end of a local training round."""
    client_did: str
    round_number: int
    weights_hash: str        # hash of the weights dict, NOT the weights themselves
    embedding_ref_hash: str  # hash of the image batch used to compute auth embeddings
    signature: str
    timestamp: float = time.time()


class SuspicionScore(BaseModel):
    """Output of auth-service for one client in one round."""
    client_did: str
    round_number: int
    outlier_fraction: float
    mean_shift: float
    micro_cluster_score: float
    reference_set_accuracy_delta: float   # NEW: direct performance-based signal
    combined_score: float
    passed: bool


class AuthDecision(str, Enum):
    ACCEPTED = "accepted"
    PROVISIONALLY_REJECTED = "provisionally_rejected"   # inside challenge window
    FINALIZED_REJECTED = "finalized_rejected"
    OVERTURNED = "overturned"                            # false positive, corrected


class Checkpoint(BaseModel):
    """One version in the rollback-service's hash chain."""
    round_number: int
    weights_hash: str
    parent_hash: Optional[str] = None     # previous checkpoint's hash, for the chain
    off_chain_uri: str                    # e.g. an IPFS CID
    is_delta: bool = True                 # True unless this is a full snapshot anchor
    reference_set_metrics: dict
    timestamp: float = time.time()


class DriftEvent(BaseModel):
    """Emitted by rollback-service's drift monitor when a rollback triggers."""
    window_start_round: int
    window_end_round: int
    trigger_reason: str
    reverted_to_checkpoint_hash: str


class AttributionResult(BaseModel):
    """Output of attribution-service for one drift event."""
    drift_event: DriftEvent
    ranked_suspects: list[tuple[str, float]]   # (client_did, similarity_to_drift_direction)


class StakeEvent(BaseModel):
    client_did: str
    event_type: str          # "staked" | "slashed" | "restored"
    amount: float
    reason: Optional[str] = None
    round_number: Optional[int] = None


class PassportEntry(BaseModel):
    """Downstream device/component lifecycle record."""
    device_id: str
    event_type: str          # "repair" | "resale" | "refurbishment" | "recycling" | "inspection"
    evidence_hash: str
    model_version_hash: str
    ai_prediction: Optional[float] = None
    actor_did: str
    signature: str
    timestamp: float = time.time()
