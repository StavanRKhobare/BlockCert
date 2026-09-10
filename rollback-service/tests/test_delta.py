import numpy as np
from shared.mock_model.mock_adapter import MockModelAdapter

from checkpoint_store.delta import apply_delta, compute_delta


def test_delta_reconstruction_exact():
    adapter = MockModelAdapter("delta-test", seed=13)
    previous = adapter.get_weights()
    current = adapter.local_train(None, inject_drift=True)

    reconstructed = apply_delta(previous, compute_delta(previous, current))
    delta_reconstruction_exact = all(
        np.array_equal(reconstructed[k], current[k]) for k in current
    )
    assert delta_reconstruction_exact

    print(f"[D2] delta_reconstruction_exact={delta_reconstruction_exact}")
