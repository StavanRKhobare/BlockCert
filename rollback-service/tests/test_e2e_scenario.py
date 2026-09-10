"""End-to-end drift/restore scenario tying D1-D4 together (no blockchain node).

Simulates 15 rounds of federated checkpointing: rounds 1-9 stable, rounds
10-15 drifting via ``MockModelAdapter.local_train(inject_drift=True)`` (the
same injection pattern fl-orchestrator will drive per round). Each round's
weights are hashed (D1) and stored (D2), and suspicion/accuracy signals feed
``DriftMonitor.ingest_round`` (D3). Once a ``DriftEvent`` fires,
``rollback_executor.execute`` (D4) must restore the exact pre-round-10 state.
"""

import numpy as np
from shared.interfaces.schemas import SuspicionScore
from shared.mock_model.mock_adapter import MockModelAdapter

from checkpoint_store.hasher import merkle_root
from checkpoint_store.local_store import LocalCheckpointStore
from drift_monitor.rollback_executor import execute
from drift_monitor.window_tracker import DriftMonitor


def _scores(combined: float, round_number: int) -> list[SuspicionScore]:
    return [
        SuspicionScore(
            client_did=f"did:example:client-{i}",
            round_number=round_number,
            outlier_fraction=0.0,
            mean_shift=0.0,
            micro_cluster_score=0.5,
            reference_set_accuracy_delta=0.0,
            combined_score=combined,
            passed=combined < 3.0,
        )
        for i in range(3)
    ]


def test_e2e_drift_triggers_and_restore_is_exact(tmp_path):
    model = MockModelAdapter("e2e-client", seed=5)
    store = LocalCheckpointStore(base_dir=str(tmp_path / "checkpoints"))
    registry: dict[str, str] = {}
    monitor = DriftMonitor()

    pre_drift_hash: str | None = None
    pre_drift_weights: dict | None = None
    drift_event = None

    for round_number in range(1, 16):
        drifting = round_number >= 10
        weights = model.local_train(None, inject_drift=drifting)
        weights_hash = merkle_root(weights)
        registry[weights_hash] = store.save_full(weights_hash, weights)
        if round_number == 9:
            pre_drift_hash = weights_hash
            pre_drift_weights = {k: v.copy() for k, v in weights.items()}

        combined = 5.0 if drifting else 0.5
        accuracy = 0.90 if not drifting else 0.90 - 0.08 * (round_number - 9)
        drift_event = monitor.ingest_round(
            round_number,
            _scores(combined, round_number),
            accuracy,
            pre_drift_hash or weights_hash,
        )
        if drift_event is not None:
            break

    e2e_drift_triggered = drift_event is not None
    assert e2e_drift_triggered
    # The monitor was always handed the pre-round-10 checkpoint hash, so the
    # executor must restore exactly the pre-drift weights.
    assert drift_event.reverted_to_checkpoint_hash == pre_drift_hash

    execute(drift_event, model, store, registry)
    restored = model.get_weights()
    e2e_restore_exact = all(
        np.array_equal(restored[k], pre_drift_weights[k])
        for k in pre_drift_weights
    )
    assert e2e_restore_exact

    print(
        f"[D6] e2e_drift_triggered={e2e_drift_triggered} "
        f"e2e_restore_exact={e2e_restore_exact}"
    )
