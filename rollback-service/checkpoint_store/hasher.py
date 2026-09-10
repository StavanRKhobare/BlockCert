"""Checkpoint hashing for the rollback-service.

Merkle-style hash over the layers of a weights dict (not one flat hash), so
partial verification and delta compression can build on per-layer hashes.
Only hashes go on-chain — never raw weights.
"""

import hashlib

import numpy as np


def hash_layer(array: np.ndarray) -> str:
    """SHA-256 hex digest of an array's raw bytes."""
    return hashlib.sha256(np.asarray(array).tobytes()).hexdigest()


def merkle_root(weights: dict[str, np.ndarray]) -> str:
    """Root hash over per-layer hashes in alphabetical layer-name order.

    Layer names are sorted so the root is deterministic regardless of dict
    insertion order.
    """
    concatenated = "".join(
        hash_layer(weights[name]) for name in sorted(weights.keys())
    )
    return hashlib.sha256(concatenated.encode("utf-8")).hexdigest()
