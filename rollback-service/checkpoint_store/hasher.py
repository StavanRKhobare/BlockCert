"""Checkpoint hashing for the rollback-service.

Merkle-style hash over the layers of a weights dict (not one flat hash), so
partial verification and delta compression can build on per-layer hashes.
Only hashes go on-chain — never raw weights.
"""

import hashlib
from typing import TYPE_CHECKING, Any

import numpy as np
from shared.interfaces.schemas import Checkpoint

if TYPE_CHECKING:
    # Imported for type hints only: local_store imports merkle_root from this
    # module at runtime, so a runtime import here would be circular.
    from checkpoint_store.local_store import LocalCheckpointStore


def hash_layer(array: np.ndarray) -> str:
    """SHA-256 hex digest of an array's raw bytes."""
    return hashlib.sha256(np.asarray(array).tobytes()).hexdigest()


def merkle_root(weights: dict[str, np.ndarray]) -> str:
    """Root hash over per-layer hashes in alphabetical layer-name order.

    Layer names are sorted so the root is deterministic regardless of dict
    insertion order.
    """
    concatenated = "".join(
        hash_layer(weights[name]) for name in sorted(weights.keys())
    )
    return hashlib.sha256(concatenated.encode("utf-8")).hexdigest()


def checkpoint_round(
    round_number: int,
    weights: dict[str, np.ndarray],
    reference_set_metrics: dict,
    store: "LocalCheckpointStore",
    previous_checkpoint: "Checkpoint | None" = None,
    full_snapshot_interval: int = 5,
    chain_client: Any = None,
) -> Checkpoint:
    """Checkpoint one round: hash, store a full snapshot, chain, optionally anchor.

    Always saves a full snapshot (``is_delta=False``); chained delta-chain
    replay is deliberately deferred (see Section 7), which keeps the D4
    rollback executor correct with zero changes since it directly loads full
    checkpoints. ``full_snapshot_interval`` is accepted for the future
    delta-chain design and currently unused.
    ``chain_client`` is type-hinted loosely (``Any``) so this module has no
    hard dependency on ``chain_bridge/``. On-chain anchoring is an additive
    audit trail: a ``ConnectionError`` from it is logged and swallowed so
    off-chain checkpoint correctness never fails just because the node is down.
    """
    weights_hash = merkle_root(weights)
    off_chain_uri = store.save_full(weights_hash, weights)
    parent_hash = (
        previous_checkpoint.weights_hash if previous_checkpoint else None
    )
    checkpoint = Checkpoint(
        round_number=round_number,
        weights_hash=weights_hash,
        parent_hash=parent_hash,
        off_chain_uri=off_chain_uri,
        is_delta=False,
        reference_set_metrics=reference_set_metrics,
    )
    if chain_client is not None:
        try:
            chain_client.anchor_checkpoint(checkpoint)
        except ConnectionError as e:
            print(f"[checkpoint_round] on-chain anchoring skipped: {e}")
    return checkpoint
