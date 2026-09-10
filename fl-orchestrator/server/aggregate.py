"""FedAvg aggregation for the fl-orchestrator."""

import numpy as np


def fedavg(
    client_weights: list[dict[str, np.ndarray]],
    client_sample_counts: list[int],
) -> dict[str, np.ndarray]:
    """Sample-count weighted average of each layer across clients.

    Raises ValueError on an empty client list (every client failed
    authentication this round) — the caller must skip the round instead of
    crashing.
    """
    if len(client_weights) == 0:
        raise ValueError(
            "no client weights to aggregate; skipping round with zero "
            "authenticated clients"
        )
    total = float(sum(client_sample_counts))
    return {
        layer: sum(
            weights[layer] * count
            for weights, count in zip(client_weights, client_sample_counts)
        )
        / total
        for layer in client_weights[0]
    }
