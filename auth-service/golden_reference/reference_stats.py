"""Golden reference statistics for the auth-service.

Computes the mean, covariance, inverse covariance, and Mahalanobis-distance
threshold of a reference embedding set (e.g. from
``shared.mock_model.make_golden_reference()``).
"""

import numpy as np

_REGULARIZATION = 1e-6


def compute_reference_stats(embeddings: np.ndarray) -> dict:
    """Compute reference statistics of an (N, D) embedding array.

    Returns ``{"mean", "covariance", "inv_covariance", "threshold"}`` where
    ``threshold`` is the 99th percentile of the Mahalanobis distance of every
    input embedding from the mean. The covariance is regularized with
    ``1e-6 * identity`` before inverting so a singular covariance never
    raises.
    """
    embeddings = np.asarray(embeddings, dtype=float)
    mean = np.mean(embeddings, axis=0)
    covariance = np.cov(embeddings, rowvar=False)
    regularized = covariance + _REGULARIZATION * np.eye(covariance.shape[0])
    inv_covariance = np.linalg.inv(regularized)
    diff = embeddings - mean
    distances = np.sqrt(
        np.einsum("ij,jk,ik->i", diff, inv_covariance, diff)
    )
    threshold = float(np.percentile(distances, 99))
    return {
        "mean": mean,
        "covariance": covariance,
        "inv_covariance": inv_covariance,
        "threshold": threshold,
    }
