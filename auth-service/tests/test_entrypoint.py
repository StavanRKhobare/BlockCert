from shared.mock_model.mock_adapter import (
    MockModelAdapter,
    make_golden_reference,
)

from entrypoint import score_client
from golden_reference.reference_stats import compute_reference_stats
from scoring.calibration import calibrate_threshold


def test_score_client_honest_passes_poisoned_fails():
    # Mirror the real production flow: calibrate from known-honest clients
    # (seeds 100-104, disjoint from golden 42-46 and fleet 0-7), stash the
    # REAL calibrated number in reference_stats, then score through it —
    # no monkeypatching, no guessed constants.
    reference_stats = compute_reference_stats(make_golden_reference())
    calibration_clients = [
        MockModelAdapter(f"calib-{i}", seed=100 + i) for i in range(5)
    ]
    calibrated = calibrate_threshold(reference_stats, calibration_clients)
    reference_stats["calibrated_threshold"] = calibrated

    # Honest baseline: a primary-fleet client (seed 3). Under the calibrated
    # threshold these pass (combined ~9.7 < ~9.98); only the poisoned client
    # is rejected.
    honest_embeddings = MockModelAdapter("client-3", seed=3).embed(n=50)
    poisoned_embeddings = MockModelAdapter("attacker", seed=999).embed(
        n=50, poisoned=True
    )

    honest = score_client(
        "did:example:honest", 1, honest_embeddings, reference_stats
    )
    poisoned = score_client(
        "did:example:attacker", 1, poisoned_embeddings, reference_stats
    )

    assert honest.passed is True
    assert poisoned.passed is False
    assert honest.client_did == "did:example:honest"
    assert honest.round_number == 1
    assert poisoned.reference_set_accuracy_delta == 0.0

    print(
        f"[B5] honest_passed={honest.passed} "
        f"poisoned_passed={poisoned.passed} "
        f"calibrated_threshold_used={calibrated}"
    )
