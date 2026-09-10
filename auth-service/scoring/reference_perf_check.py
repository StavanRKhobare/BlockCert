"""Reference-set performance check for the auth-service.

Direct, non-embedding-based signal: run the candidate global model against a
small labeled golden set each round and track the accuracy delta.
"""

from typing import Any

import numpy as np
from shared.interfaces.model_adapter import ModelAdapter


def reference_set_accuracy_delta(
    model_adapter: ModelAdapter,
    golden_labeled_images: Any,
    golden_labels: np.ndarray,
    baseline_accuracy: float,
) -> float:
    """Return (new_accuracy - baseline_accuracy) on the golden labeled set.

    NOTE: this check becomes meaningful once real labeled data exists. The
    MockModelAdapter returns random scores regardless of input, so tests for
    this function confirm the ARITHMETIC (thresholding + accuracy + delta),
    not any model quality.
    """
    scores = np.asarray(
        model_adapter.predict_anomaly_score(golden_labeled_images), dtype=float
    )
    predictions = (scores >= 0.5).astype(int)
    labels = np.asarray(golden_labels, dtype=int)
    new_accuracy = float(np.mean(predictions == labels))
    return new_accuracy - baseline_accuracy
