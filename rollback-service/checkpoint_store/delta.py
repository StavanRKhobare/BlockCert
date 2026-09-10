"""Delta compression between consecutive weight snapshots.

Both dicts always share the same keys/shapes under the fixed ModelAdapter
contract — mismatched shapes are not handled here since they would indicate
a bug elsewhere.
"""

import numpy as np


def compute_delta(
    previous: dict[str, np.ndarray], current: dict[str, np.ndarray]
) -> dict[str, np.ndarray]:
    """Elementwise subtraction: ``current[k] - previous[k]`` per layer."""
    return {k: current[k] - previous[k] for k in current}


def apply_delta(
    previous: dict[str, np.ndarray], delta: dict[str, np.ndarray]
) -> dict[str, np.ndarray]:
    """Inverse of :func:`compute_delta`: ``previous[k] + delta[k]``."""
    return {k: previous[k] + delta[k] for k in previous}
