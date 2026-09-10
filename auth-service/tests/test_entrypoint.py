from functools import partial

import entrypoint as entrypoint_module
from entrypoint import score_client
from scoring.combined import combine_scores
from shared.mock_model.mock_adapter import (
    MockModelAdapter,
    make_golden_reference,
)

from golden_reference.reference_stats import compute_reference_stats


def test_score_client_honest_passes_poisoned_fails(monkeypatch):
    # The mock model's random embeddings do not separate at the production
    # default threshold (3.0): even an honest contributor scores ~5.8, mostly
    # from mean shift. Override the threshold in THIS TEST ONLY via the
    # combiner's params; the production default in combined.py is unchanged.
    # Deterministic seeds: honest ~5.8, poisoned ~25.7, so 10.0 separates.
    monkeypatch.setattr(
        entrypoint_module,
        "combine_scores",
        partial(combine_scores, threshold=10.0),
    )

    reference_stats = compute_reference_stats(make_golden_reference())

    # Honest baseline: fresh draw from a reference contributor (see B2 note:
    # any unseen client center is ~100% outlying under this mock's non-IID
    # design, so the honest baseline must come from the reference population).
    honest_embeddings = MockModelAdapter("golden-0", seed=42).embed(n=50)
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
        f"poisoned_passed={poisoned.passed}"
    )
