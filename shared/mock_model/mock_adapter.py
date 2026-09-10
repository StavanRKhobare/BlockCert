"""
MockModelAdapter — a stand-in for the real anomaly-detection model, used by
every OTHER module during development so nobody is blocked waiting on the
vision model to be trained.

It produces deterministic, seeded fake weights and embeddings that behave
"model-shaped enough" to exercise the real logic in fl-orchestrator,
auth-service, and rollback-service:
  - get_weights/set_weights round-trip a small dict of numpy arrays, same
    shape every time, so aggregation/hashing/delta-compression code can be
    written and tested against something real-looking.
  - local_train nudges the weights slightly (simulating a gradient step) and
    lets you inject an `inject_drift=True` flag to simulate a poisoned/bad
    client update on purpose, for testing the drift monitor.
  - embed() draws from a per-"class" Gaussian so auth-service's outlier /
    mean-shift / micro-cluster math has something realistic to chew on,
    including an injectable poisoned-cluster mode.

Swap this for the real model by pointing fl-orchestrator/client_sim at a
class that implements the same ModelAdapter interface — nothing else in the
repo changes.
"""

import numpy as np
from shared.interfaces.model_adapter import ModelAdapter

_WEIGHT_SHAPES = {"layer1": (16, 16), "layer2": (8, 8), "head": (4,)}
_EMBED_DIM = 32


class MockModelAdapter(ModelAdapter):
    def __init__(self, client_did: str, seed: int = 0):
        self.client_did = client_did
        self._rng = np.random.default_rng(seed)
        self._weights = {
            name: self._rng.normal(0, 0.1, size=shape)
            for name, shape in _WEIGHT_SHAPES.items()
        }
        # each simulated client has its own "true" embedding cluster center,
        # so non-IID-ness is baked in from the start
        self._class_center = self._rng.normal(0, 1, size=_EMBED_DIM)

    def get_weights(self) -> dict[str, np.ndarray]:
        return {k: v.copy() for k, v in self._weights.items()}

    def set_weights(self, weights: dict[str, np.ndarray]) -> None:
        self._weights = {k: v.copy() for k, v in weights.items()}

    def local_train(self, local_data=None, epochs: int = 1, inject_drift: bool = False) -> dict[str, np.ndarray]:
        step_scale = 0.05 if not inject_drift else 0.9   # a poisoned client "trains" much harder
        for name in self._weights:
            self._weights[name] += self._rng.normal(0, step_scale, size=self._weights[name].shape)
        return self.get_weights()

    def embed(self, images=None, n: int = 16, poisoned: bool = False) -> np.ndarray:
        center = self._class_center if not poisoned else self._class_center + self._rng.normal(4, 0.5, size=_EMBED_DIM)
        return self._rng.normal(loc=center, scale=0.5, size=(n, _EMBED_DIM))

    def predict_anomaly_score(self, images=None, n: int = 16) -> np.ndarray:
        return self._rng.uniform(0, 1, size=n)


def make_golden_reference(n_clients: int = 5, seed: int = 42) -> np.ndarray:
    """Convenience helper for auth-service tests: builds a synthetic 'clean'
    embedding reference set by pooling several honest mock clients."""
    rng = np.random.default_rng(seed)
    clients = [MockModelAdapter(f"golden-{i}", seed=seed + i) for i in range(n_clients)]
    return np.vstack([c.embed(n=50) for c in clients])
