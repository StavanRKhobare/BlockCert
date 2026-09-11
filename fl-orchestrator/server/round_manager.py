"""Round manager for the fl-orchestrator.

Drives simulated clients through authentication-gated federated rounds.
``auth-service/`` and ``rollback-service/`` are on ``sys.path`` (see
``tests/conftest.py``) so the real ``score_client`` entrypoint and the real
``checkpoint_round`` are used — never local copies. The drift-monitor
``ingest_round`` and ``execute`` calls below are still local stubs (marked
``# TODO(rollback-service)``) until those touchpoints are wired.
"""

from entrypoint import score_client
from shared.interfaces.model_adapter import ModelAdapter
from shared.interfaces.schemas import Checkpoint, DriftEvent, SuspicionScore

from checkpoint_store.hasher import checkpoint_round
from checkpoint_store.local_store import LocalCheckpointStore
from client_sim.simulated_client import SimulatedClient
from server.aggregate import fedavg

# Round manager owns the cross-round checkpointing state: one shared store
# and the previous round's Checkpoint, threaded into each checkpoint_round
# call so the hash chain links up (hasher.py itself is stateless).
_default_store = LocalCheckpointStore()
_previous_checkpoint: Checkpoint | None = None

# Placeholder until a real per-round reference-set accuracy is available to
# the round manager (vision-model era); only consumed by the ingest stub.
_PLACEHOLDER_ACCURACY = 0.9


# TODO(rollback-service): wire real import once Epic D exists.
def ingest_round(
    round_number: int,
    suspicion_scores: list[SuspicionScore],
    reference_set_accuracy: float,
) -> DriftEvent | None:
    """Stub of touchpoint #3 with the exact §1.3 signature."""
    return None


# TODO(rollback-service): wire real import once Epic D exists.
def execute(drift_event: DriftEvent, model_adapter: ModelAdapter) -> None:
    """Stub of touchpoint #4 with the exact §1.3 signature."""
    return None


def authenticate_round(
    clients: list[SimulatedClient],
    round_number: int,
    reference_stats: dict,
) -> tuple[list[SimulatedClient], list[SuspicionScore]]:
    """Authenticate every client for one round (touchpoint #1).

    Returns the sub-list of clients whose score passed, plus ALL suspicion
    scores (passed and failed) — the full list is needed later by the drift
    monitor (touchpoint #3).
    """
    passing: list[SimulatedClient] = []
    all_scores: list[SuspicionScore] = []
    for client in clients:
        embeddings = client.model_adapter.embed()
        score = score_client(
            client.client_did, round_number, embeddings, reference_stats
        )
        all_scores.append(score)
        if score.passed:
            passing.append(client)
    return passing, all_scores


def run_round(
    clients: list[SimulatedClient],
    round_number: int,
    reference_stats: dict,
    global_model: ModelAdapter,
) -> dict:
    """Run one full federated round; return a summary dict.

    (1) authenticate, (2) train passing clients, (3) FedAvg, (4) broadcast to
    the global model, (5) checkpoint via the REAL ``checkpoint_round``
    (touchpoint #2), (6) drift check via the ingest stub (touchpoint #3),
    (7) rollback via the execute stub if a DriftEvent returns (touchpoint #4).

    With zero passing clients the round is skipped (per C2's contract) and
    reported with ``drift_triggered=False``.
    """
    global _previous_checkpoint
    passing, all_scores = authenticate_round(
        clients, round_number, reference_stats
    )
    n_failed = len(clients) - len(passing)
    if not passing:
        return {
            "round": round_number,
            "n_passed": 0,
            "n_failed": n_failed,
            "drift_triggered": False,
        }
    trained = [client.run_round() for client in passing]
    # Placeholder: real per-client sample counts arrive with the vision model.
    aggregated = fedavg(trained, [1] * len(trained))
    global_model.set_weights(aggregated)
    checkpoint = checkpoint_round(
        round_number,
        aggregated,
        {"n_passed": len(passing), "n_failed": n_failed},
        _default_store,
        _previous_checkpoint,
    )
    _previous_checkpoint = checkpoint
    drift_event = ingest_round(round_number, all_scores, _PLACEHOLDER_ACCURACY)
    drift_triggered = drift_event is not None
    if drift_triggered:
        execute(drift_event, global_model)
    return {
        "round": round_number,
        "n_passed": len(passing),
        "n_failed": n_failed,
        "drift_triggered": drift_triggered,
    }
