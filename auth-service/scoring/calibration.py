"""Threshold calibration for the auth-service.

Derives a pass/fail threshold from the combined scores of a small set of
known-honest calibration clients: ``mean + k * std``. Calibration clients
must use seeds that overlap neither the golden reference's seeds (42-46) nor
the primary fleet's seeds (0-7) — e.g. seeds 100-104 — to avoid calibrating a
client against a reference partly built from itself.
"""

import numpy as np

from scoring.combined import combine_scores
from scoring.suspicion import (
    mean_shift,
    micro_cluster_score,
    outlier_fraction,
)


def calibrate_threshold(
    reference_stats: dict, calibration_clients: list, k: float = 3.0
) -> float:
    """Return ``mean(combined) + k * std(combined)`` over calibration clients.

    Reuses B2's scoring functions and B4's ``combine_scores`` (production
    defaults, ``ref_perf_delta=0.0``) exactly — nothing is reimplemented here.
    """
    scores = []
    for client in calibration_clients:
        embeddings = client.embed(n=50)
        outlier_frac = outlier_fraction(embeddings, reference_stats)
        shift = mean_shift(embeddings, reference_stats)
        cluster = micro_cluster_score(embeddings, reference_stats["embeddings"])
        combined, _ = combine_scores(outlier_frac, shift, cluster, 0.0)
        scores.append(combined)
    return float(np.mean(scores) + k * np.std(scores))
