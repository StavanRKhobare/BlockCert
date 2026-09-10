"""Rollback executor for the rollback-service (integration touchpoint #4).

Restores a model adapter's weights in place from the checkpoint named in a
``DriftEvent``. Integrity-verified: never silently restores unverified
weights.
"""

from shared.interfaces.model_adapter import ModelAdapter
from shared.interfaces.schemas import DriftEvent

from checkpoint_store.local_store import LocalCheckpointStore


def execute(
    drift_event: DriftEvent,
    model_adapter: ModelAdapter,
    store: LocalCheckpointStore,
    checkpoint_registry: dict[str, str],
) -> None:
    """Restore ``model_adapter`` to the checkpoint named by the drift event.

    ``checkpoint_registry`` maps weights_hash -> off_chain_uri and is
    maintained by the caller.
    """
    weights_hash = drift_event.reverted_to_checkpoint_hash
    off_chain_uri = checkpoint_registry[weights_hash]
    try:
        loaded_weights = store.load(off_chain_uri)
        integrity_ok = store.verify_integrity(off_chain_uri, weights_hash)
    except Exception as exc:
        raise ValueError(
            f"checkpoint {weights_hash!r} could not be loaded/verified; "
            "refusing to restore unverified weights"
        ) from exc
    if not integrity_ok:
        raise ValueError(
            f"checkpoint integrity check failed for {weights_hash!r}; "
            "refusing to restore unverified weights"
        )
    model_adapter.set_weights(loaded_weights)
