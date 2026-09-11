from shared.mock_model.mock_adapter import (
    MockModelAdapter,
    make_golden_reference,
)

from golden_reference.reference_stats import compute_reference_stats
from scoring.calibration import calibrate_threshold
from scoring.combined import combine_scores
from scoring.suspicion import (
    mean_shift,
    micro_cluster_score,
    outlier_fraction,
)


def _combined_for(embeddings, reference_stats) -> float:
    outlier_frac = outlier_fraction(embeddings, reference_stats)
    shift = mean_shift(embeddings, reference_stats)
    cluster = micro_cluster_score(embeddings, reference_stats["embeddings"])
    combined, _ = combine_scores(outlier_frac, shift, cluster, 0.0)
    return combined


def test_calibrated_threshold_separates():
    reference_embeddings = make_golden_reference()
    reference_stats = compute_reference_stats(reference_embeddings)

    calibration_clients = [
        MockModelAdapter(f"calib-{i}", seed=100 + i) for i in range(5)
    ]
    calibrated = calibrate_threshold(reference_stats, calibration_clients)

    honest_scores = [
        _combined_for(
            MockModelAdapter(f"client-{i}", seed=i).embed(n=50),
            reference_stats,
        )
        for i in range(8)
    ]
    max_honest = max(honest_scores)
    attacker_score = _combined_for(
        MockModelAdapter("attacker", seed=999).embed(n=50, poisoned=True),
        reference_stats,
    )

    separates = max_honest < calibrated < attacker_score
    assert separates

    print(
        f"[B4.5] calibrated_threshold={calibrated} max_honest={max_honest} "
        f"attacker_score={attacker_score} separates_correctly={separates}"
    )
