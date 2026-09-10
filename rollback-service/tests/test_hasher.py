from shared.mock_model.mock_adapter import MockModelAdapter

from checkpoint_store.hasher import merkle_root


def test_hasher_properties():
    adapter = MockModelAdapter("hasher-test", seed=7)
    weights = adapter.get_weights()

    root_a = merkle_root(weights)
    root_b = merkle_root(adapter.get_weights())
    deterministic = root_a == root_b

    tampered = {k: v.copy() for k, v in weights.items()}
    tampered["layer1"][0, 0] += 1e-12
    sensitive_to_change = merkle_root(tampered) != root_a

    reordered = {
        "head": weights["head"],
        "layer2": weights["layer2"],
        "layer1": weights["layer1"],
    }
    order_insensitive = merkle_root(reordered) == root_a

    assert deterministic
    assert sensitive_to_change
    assert order_insensitive
    print(
        f"[D1] deterministic={deterministic} "
        f"sensitive_to_change={sensitive_to_change} "
        f"order_insensitive={order_insensitive}"
    )
