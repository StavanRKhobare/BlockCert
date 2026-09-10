"""Public entrypoint for the auth-service (integration touchpoint #1).

``score_client`` scores one client's embeddings for one round against
precomputed golden reference statistics and returns a ``SuspicionScore``.
Only clients with ``SuspicionScore.passed == True`` are included in that
round's FedAvg aggregation.
"""

import numpy as np
from shared.interfaces.schemas import SuspicionScore

from scoring.combined import combine_scores
from scoring.suspicion import (
    mean_shift,
    micro_cluster_score,
    outlier_fraction,
)


def score_client(
    client_did: str,
    round_number: int,
    embeddings: np.ndarray,
    reference_stats: dict,
) -> SuspicionScore:
    """Score a client's embeddings against precomputed reference stats.

    ``reference_stats`` is computed once (B1) and reused across calls — this
    function does NOT recompute reference stats.
    """
    outlier_frac = outlier_fraction(embeddings, reference_stats)
    shift = mean_shift(embeddings, reference_stats)
    cluster = micro_cluster_score(embeddings, reference_stats["embeddings"])
    # B3 is not wired in here yet: reference_set_accuracy_delta needs golden
    # labeled images, which do not exist until the vision model does. Wiring
    # it is gateway work for batch 2.
    ref_perf_delta = 0.0
    combined, passed = combine_scores(outlier_frac, shift, cluster, ref_perf_delta)
    return SuspicionScore(
        client_did=client_did,
        round_number=round_number,
        outlier_fraction=outlier_frac,
        mean_shift=shift,
        micro_cluster_score=cluster,
        reference_set_accuracy_delta=ref_perf_delta,
        combined_score=combined,
        passed=passed,
    )
