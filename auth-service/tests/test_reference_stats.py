import numpy as np

from shared.mock_model.mock_adapter import make_golden_reference

from golden_reference.reference_stats import compute_reference_stats


def test_reference_stats_shapes_and_threshold():
    embeddings = make_golden_reference()
    stats = compute_reference_stats(embeddings)
    assert stats["mean"].shape == (32,)
    assert stats["covariance"].shape == (32, 32)
    assert stats["threshold"] > 0
    assert stats["embeddings"].shape == embeddings.shape
    assert np.array_equal(np.asarray(stats["embeddings"]), np.asarray(embeddings))
    print(
        f"[B1] mean_shape={stats['mean'].shape} threshold={stats['threshold']}"
    )
