"""Combined suspicion score and pass/fail decision for the auth-service.

Placeholder weights and threshold (see integration doc Section 7) — do not
tune, the formula below is implemented exactly as specified.
"""


def combine_scores(
    outlier_frac: float,
    mean_shift_val: float,
    cluster_score: float,
    ref_perf_delta: float,
    weights: dict = {
        "outlier": 2.0,
        "shift": 1.0,
        "cluster": 1.5,
        "perf": 1.0,
    },
    threshold: float = 3.0,
) -> tuple[float, bool]:
    """Combine the four signals into (combined_score, passed).

    A negative performance delta (accuracy got worse) ADDS to suspicion via
    ``- weights["perf"] * min(ref_perf_delta, 0)``; a positive delta
    contributes zero. ``passed`` is True when the score is BELOW threshold.
    """
    combined = (
        weights["outlier"] * outlier_frac
        + weights["shift"] * mean_shift_val
        + weights["cluster"] * cluster_score
        - weights["perf"] * min(ref_perf_delta, 0)
    )
    return (combined, combined < threshold)
