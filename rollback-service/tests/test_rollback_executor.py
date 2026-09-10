import numpy as np
import pytest
from shared.interfaces.schemas import DriftEvent
from shared.mock_model.mock_adapter import MockModelAdapter

from checkpoint_store.hasher import merkle_root
from checkpoint_store.local_store import LocalCheckpointStore
from drift_monitor.rollback_executor import execute


def _drift_event(weights_hash: str) -> DriftEvent:
    return DriftEvent(
        window_start_round=3,
        window_end_round=7,
        trigger_reason="sustained suspicion + accuracy decline over window",
        reverted_to_checkpoint_hash=weights_hash,
    )


def test_execute_restores_saved_weights(tmp_path):
    adapter = MockModelAdapter("rollback-test", seed=21)
    saved_weights = adapter.get_weights()
    weights_hash = merkle_root(saved_weights)

    store = LocalCheckpointStore(base_dir=str(tmp_path / "checkpoints"))
    uri = store.save_full(weights_hash, saved_weights)
    registry = {weights_hash: uri}

    for _ in range(3):
        adapter.local_train(None, inject_drift=True)
    assert not all(
        np.array_equal(adapter.get_weights()[k], saved_weights[k])
        for k in saved_weights
    )

    execute(_drift_event(weights_hash), adapter, store, registry)

    restored = adapter.get_weights()
    restore_exact = all(
        np.array_equal(restored[k], saved_weights[k]) for k in saved_weights
    )
    assert restore_exact
    print(f"[D4] restore_exact={restore_exact}")


def test_execute_refuses_tampered_checkpoint(tmp_path):
    adapter = MockModelAdapter("rollback-test", seed=21)
    saved_weights = adapter.get_weights()
    weights_hash = merkle_root(saved_weights)

    store = LocalCheckpointStore(base_dir=str(tmp_path / "checkpoints"))
    uri = store.save_full(weights_hash, saved_weights)
    registry = {weights_hash: uri}

    path = uri[len("local://"):]
    with open(path, "r+b") as f:
        data = bytearray(f.read())
        data[len(data) // 2] ^= 0xFF
        f.seek(0)
        f.write(data)

    with pytest.raises(ValueError, match="unverified weights"):
        execute(_drift_event(weights_hash), adapter, store, registry)
    corruption_blocks_restore = True
    print(f"[D4] corruption_blocks_restore={corruption_blocks_restore}")
