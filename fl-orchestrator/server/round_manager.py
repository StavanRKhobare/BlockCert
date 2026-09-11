"""Round manager for the fl-orchestrator.

Drives simulated clients through authentication-gated federated rounds.
``auth-service/`` and ``rollback-service/`` are on ``sys.path`` (see
``tests/conftest.py``) so the real ``score_client`` entrypoint, the real
``checkpoint_round``, the real ``DriftMonitor``, and the real
``rollback_executor.execute`` are used — never local copies or stubs.
"""

from entrypoint import score_client
from shared.interfaces.model_adapter import ModelAdapter
from shared.interfaces.schemas import Checkpoint, SuspicionScore

from checkpoint_store.hasher import checkpoint_round
from checkpoint_store.local_store import LocalCheckpointStore
from client_sim.simulated_client import SimulatedClient
from drift_monitor.rollback_executor import execute
from drift_monitor.window_tracker import DriftMonitor
from server.aggregate import fedavg

# Round manager owns the cross-round shared state: one store, one stateful
# drift monitor, one hash->URI registry, and the previous round's Checkpoint
# (threaded into each checkpoint_round call so the hash chain links up —
# hasher.py itself is stateless). Callers may pass their own
# previous_checkpoint/checkpoint_registry per round; the module-level copies
# below are the defaults that persist across rounds.
_default_store = LocalCheckpointStore()
_default_monitor = DriftMonitor()
_default_registry: dict[str, str] = {}
_previous_checkpoint: Checkpoint | None = None

# Placeholder until a real per-round reference-set accuracy is available to
# the round manager (vision-model era).
_PLACEHOLDER_ACCURACY = 0.9


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
    previous_checkpoint: Checkpoint | None = None,
    checkpoint_registry: dict[str, str] | None = None,
) -> dict:
    """Run one full federated round; return a summary dict.

    (1) authenticate, (2) train passing clients, (3) FedAvg, (4) broadcast to
    the global model, (5) checkpoint via the REAL ``checkpoint_round``
    (touchpoint #2), appending ``{weights_hash: off_chain_uri}`` into
    ``checkpoint_registry`` (caller's dict, mutated in place; defaults to the
    module-level registry), (6) drift check via the REAL ``DriftMonitor``
    (touchpoint #3), (7) rollback via the REAL ``execute`` (touchpoint #4) if
    a DriftEvent returns.

    ``previous_checkpoint`` defaults to the module-level previous checkpoint
    so successive calls chain without the caller threading anything; pass an
    explicit one to override. With zero passing clients the round is skipped
    (per C2's contract) and reported with ``drift_triggered=False``.

    NOTE: the hash handed to the drift monitor as the revert anchor is the
    latest checkpoint known before this round's save. Tracking the exact
    pre-window checkpoint across a rolling window is future round-manager
    work — the monitor only consumes it if it fires.
    """
    global _previous_checkpoint
    if previous_checkpoint is None:
        previous_checkpoint = _previous_checkpoint
    if checkpoint_registry is None:
        checkpoint_registry = _default_registry
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
    anchor_hash = (
        previous_checkpoint.weights_hash if previous_checkpoint else None
    )
    checkpoint = checkpoint_round(
        round_number,
        aggregated,
        {"n_passed": len(passing), "n_failed": n_failed},
        _default_store,
        previous_checkpoint,
    )
    checkpoint_registry[checkpoint.weights_hash] = checkpoint.off_chain_uri
    _previous_checkpoint = checkpoint
    drift_event = _default_monitor.ingest_round(
        round_number,
        all_scores,
        _PLACEHOLDER_ACCURACY,
        anchor_hash or checkpoint.weights_hash,
    )
    drift_triggered = drift_event is not None
    if drift_triggered:
        execute(drift_event, global_model, _default_store, checkpoint_registry)
    return {
        "round": round_number,
        "n_passed": len(passing),
        "n_failed": n_failed,
        "drift_triggered": drift_triggered,
    }
