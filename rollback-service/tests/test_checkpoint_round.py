import numpy as np
from shared.mock_model.mock_adapter import MockModelAdapter

from checkpoint_store.hasher import checkpoint_round
from checkpoint_store.local_store import LocalCheckpointStore


class AlwaysFailingChainClient:
    def anchor_checkpoint(self, checkpoint):
        raise ConnectionError("node is down for this test")


def test_checkpoint_round_hash_chain_and_restore(tmp_path):
    adapter = MockModelAdapter("checkpoint-round-test", seed=31)
    store = LocalCheckpointStore(base_dir=str(tmp_path / "checkpoints"))

    rounds = []
    previous = None
    originals = []
    for round_number in (1, 2, 3):
        weights = adapter.local_train(None)
        originals.append({k: v.copy() for k, v in weights.items()})
        checkpoint = checkpoint_round(
            round_number, weights, {"accuracy": 0.9}, store, previous
        )
        rounds.append(checkpoint)
        previous = checkpoint

    hashes = [c.weights_hash for c in rounds]
    hash_chain_valid = (
        len(set(hashes)) == 3
        and rounds[1].parent_hash == rounds[0].weights_hash
        and rounds[2].parent_hash == rounds[1].weights_hash
        and rounds[0].parent_hash is None
    )
    assert hash_chain_valid

    loaded = store.load(rounds[0].off_chain_uri)
    restore_exact = all(
        np.array_equal(loaded[k], originals[0][k]) for k in originals[0]
    )
    assert restore_exact
    assert all(c.is_delta is False for c in rounds)

    # chain_client=None: no error.
    checkpoint_round(4, adapter.get_weights(), {}, store, rounds[2])
    # Failing chain client: still returns a valid Checkpoint, no raise.
    fallback = checkpoint_round(
        5,
        adapter.get_weights(),
        {},
        store,
        rounds[2],
        chain_client=AlwaysFailingChainClient(),
    )
    chain_anchor_optional_ok = isinstance(fallback.weights_hash, str) and bool(
        fallback.off_chain_uri
    )
    assert chain_anchor_optional_ok

    print(
        f"[D2.5] rounds=3 hash_chain_valid={hash_chain_valid} "
        f"restore_exact={restore_exact} "
        f"chain_anchor_optional_ok={chain_anchor_optional_ok}"
    )
