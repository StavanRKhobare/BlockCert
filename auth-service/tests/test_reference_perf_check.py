import numpy as np

from scoring.reference_perf_check import reference_set_accuracy_delta


class FixedScoreAdapter:
    """Fake stand-in (not MockModelAdapter) returning a fixed known array."""

    def __init__(self, scores: np.ndarray):
        self._scores = np.asarray(scores, dtype=float)

    def predict_anomaly_score(self, images=None) -> np.ndarray:
        return self._scores


def test_reference_set_accuracy_delta_exact():
    # scores >= 0.5 -> [1, 0, 1, 0]; labels [1, 0, 0, 0] -> 3/4 correct.
    adapter = FixedScoreAdapter(np.array([0.9, 0.1, 0.6, 0.4]))
    labels = np.array([1, 0, 0, 0])
    baseline_accuracy = 0.5
    expected_delta = 0.75 - 0.5

    computed_delta = reference_set_accuracy_delta(
        adapter, None, labels, baseline_accuracy
    )
    assert computed_delta == expected_delta
    print(
        f"[B3] computed_delta={computed_delta} expected_delta={expected_delta}"
    )
