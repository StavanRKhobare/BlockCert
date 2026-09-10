import numpy as np
import pytest

from server.aggregate import fedavg


def _weights(values: dict[str, float]) -> dict[str, np.ndarray]:
    return {k: np.full((2, 2), v) for k, v in values.items()}


def test_fedavg_cases():
    # Equal sample counts -> exact elementwise mean: (1+2+3)/3 = 2.
    equal = fedavg(
        [_weights({"a": 1.0}), _weights({"a": 2.0}), _weights({"a": 3.0})],
        [10, 10, 10],
    )
    equal_ok = bool(np.array_equal(equal["a"], np.full((2, 2), 2.0)))
    assert equal_ok

    # Unequal counts: (1*1 + 2*2 + 3*3) / 6 = 14/6.
    weighted = fedavg(
        [_weights({"a": 1.0}), _weights({"a": 2.0}), _weights({"a": 3.0})],
        [1, 2, 3],
    )
    weighted_ok = bool(
        np.array_equal(weighted["a"], np.full((2, 2), 14.0 / 6.0))
    )
    assert weighted_ok

    # Empty list -> ValueError (caller must skip the round).
    with pytest.raises(ValueError):
        fedavg([], [])
    empty_ok = True

    print(
        f"[C2] equal_weights_case={equal_ok} weighted_case={weighted_ok} "
        f"empty_case={empty_ok}"
    )
