from shared.mock_model.mock_adapter import (
    MockModelAdapter,
    make_golden_reference,
)

from golden_reference.reference_stats import compute_reference_stats
from scoring.suspicion import (
    mean_shift,
    micro_cluster_score,
    outlier_fraction,
)


def test_poisoned_client_scores_above_honest():
    reference_embeddings = make_golden_reference()
    reference_stats = compute_reference_stats(reference_embeddings)

    # NOTE: the honest baseline is a fresh draw from a client that contributed
    # to the golden reference (seed 42 == "golden-0"). MockModelAdapter bakes
    # in non-IID per-client centers, so ANY unseen client center is ~100%
    # outlying versus a 5-client reference by Mahalanobis distance; only an
    # honest client from the reference population scores low. Mean shift
    # separates poisoned from honest regardless of which honest client is used.
    honest = MockModelAdapter("golden-0", seed=42).embed(n=50)
    poisoned = MockModelAdapter("attacker", seed=999).embed(
        n=50, poisoned=True
    )

    honest_outlier = outlier_fraction(honest, reference_stats)
    poisoned_outlier = outlier_fraction(poisoned, reference_stats)
    honest_shift = mean_shift(honest, reference_stats)
    poisoned_shift = mean_shift(poisoned, reference_stats)
    honest_cluster = micro_cluster_score(honest, reference_embeddings)
    poisoned_cluster = micro_cluster_score(poisoned, reference_embeddings)

    assert poisoned_outlier > honest_outlier
    assert poisoned_shift > honest_shift

    print(
        f"[B2] honest_outlier={honest_outlier} "
        f"poisoned_outlier={poisoned_outlier} "
        f"honest_shift={honest_shift} "
        f"poisoned_shift={poisoned_shift} "
        f"honest_cluster={honest_cluster} "
        f"poisoned_cluster={poisoned_cluster}"
    )
