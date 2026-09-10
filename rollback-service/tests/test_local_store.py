import numpy as np
from shared.mock_model.mock_adapter import MockModelAdapter

from checkpoint_store.hasher import merkle_root
from checkpoint_store.local_store import LocalCheckpointStore


def test_save_load_verify_and_corruption(tmp_path):
    adapter = MockModelAdapter("store-test", seed=11)
    weights = adapter.get_weights()
    weights_hash = merkle_root(weights)

    store = LocalCheckpointStore(base_dir=str(tmp_path / "checkpoints"))
    uri = store.save_full(weights_hash, weights)

    loaded = store.load(uri)
    roundtrip_exact = all(
        np.array_equal(loaded[k], weights[k]) for k in weights
    )
    assert roundtrip_exact
    assert store.verify_integrity(uri, weights_hash) is True

    # Corrupt the saved file byte-for-byte on disk.
    path = uri[len("local://"):]
    with open(path, "r+b") as f:
        data = bytearray(f.read())
        data[len(data) // 2] ^= 0xFF
        f.seek(0)
        f.write(data)
    corruption_detected = store.verify_integrity(uri, weights_hash) is False
    assert corruption_detected

    print(
        f"[D2] roundtrip_exact={roundtrip_exact} "
        f"corruption_detected={corruption_detected}"
    )
