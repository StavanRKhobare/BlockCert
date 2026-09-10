"""Suspicion scoring primitives for the auth-service.

Three embedding-based signals comparing a client's embeddings against a
golden reference set:
- outlier_fraction: share of client embeddings outside the reference
  Mahalanobis threshold.
- mean_shift: Euclidean drift of the client mean from the reference mean.
- micro_cluster_score: how cleanly client embeddings separate from reference
  embeddings under 2-means clustering.
"""

import numpy as np
from sklearn.cluster import KMeans


def _mahalanobis_distances(
    embeddings: np.ndarray, reference_stats: dict
) -> np.ndarray:
    diff = np.asarray(embeddings, dtype=float) - reference_stats["mean"]
    inv_cov = reference_stats["inv_covariance"]
    return np.sqrt(np.einsum("ij,jk,ik->i", diff, inv_cov, diff))


def outlier_fraction(
    client_embeddings: np.ndarray, reference_stats: dict
) -> float:
    """Fraction of client embeddings whose Mahalanobis distance from the
    reference mean exceeds the reference threshold."""
    distances = _mahalanobis_distances(client_embeddings, reference_stats)
    return float(np.mean(distances > reference_stats["threshold"]))


def mean_shift(client_embeddings: np.ndarray, reference_stats: dict) -> float:
    """Euclidean distance between the client mean and the reference mean."""
    return float(
        np.linalg.norm(
            np.mean(np.asarray(client_embeddings, dtype=float), axis=0)
            - reference_stats["mean"]
        )
    )


def micro_cluster_score(
    client_embeddings: np.ndarray, reference_embeddings: np.ndarray
) -> float:
    """Concatenate both sets, run KMeans(k=2), and return the highest
    client-point fraction across the two clusters.

    0.5 means no separation (with equally sized sets), 1.0 means the client
    points form a perfectly pure cluster of their own.
    """
    client_embeddings = np.asarray(client_embeddings, dtype=float)
    reference_embeddings = np.asarray(reference_embeddings, dtype=float)
    combined = np.vstack([client_embeddings, reference_embeddings])
    labels = KMeans(n_clusters=2, n_init=10, random_state=0).fit_predict(combined)
    n_client = client_embeddings.shape[0]
    scores = []
    for cluster in (0, 1):
        in_cluster = labels == cluster
        size = int(np.sum(in_cluster))
        if size == 0:
            continue
        n_client_in_cluster = int(np.sum(in_cluster[:n_client]))
        scores.append(n_client_in_cluster / size)
    return float(max(scores))
