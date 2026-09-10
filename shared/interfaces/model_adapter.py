"""
ModelAdapter — the one contract that decouples every other module from the
real vision/anomaly model.

Whoever builds the actual defect-detection model (teammate) only has to
subclass this and implement these five methods. Every other module
(fl-orchestrator, auth-service, rollback-service, attribution-service) is
written against THIS interface, never against a concrete model class — so
swapping shared.mock_model.mock_adapter.MockModelAdapter for the real
implementation requires zero changes anywhere else in the repo.

Keep this file's method signatures stable. If you need to change them,
that's an ADR (see /docs/adr), not a quick edit.
"""

from abc import ABC, abstractmethod
from typing import Any
import numpy as np


class ModelAdapter(ABC):
    """Abstract contract for a client-side (or global) model used in an FL round."""

    @abstractmethod
    def get_weights(self) -> dict[str, np.ndarray]:
        """Return the current model's weights as a flat {layer_name: array} dict.

        Used by: fl-orchestrator (to aggregate), rollback-service (to hash /
        checkpoint / delta-compress).
        """
        raise NotImplementedError

    @abstractmethod
    def set_weights(self, weights: dict[str, np.ndarray]) -> None:
        """Load a weights dict back into the model (e.g. after aggregation, or
        after a rollback restores a prior checkpoint).
        """
        raise NotImplementedError

    @abstractmethod
    def local_train(self, local_data: Any, epochs: int = 1) -> dict[str, np.ndarray]:
        """Train on this client's local data for `epochs` epochs, starting from
        the model's current weights, and return the resulting weights dict.

        Used by: fl-orchestrator, once per client per round.
        """
        raise NotImplementedError

    @abstractmethod
    def embed(self, images: Any) -> np.ndarray:
        """Run images through the FIXED, shared feature extractor (e.g. a
        frozen ViT) and return an (N, D) embedding array. This is never
        trained — see FedEDAuth's authentication design.

        Used by: auth-service, to compute suspicion scores.
        """
        raise NotImplementedError

    @abstractmethod
    def predict_anomaly_score(self, images: Any) -> np.ndarray:
        """Run the CURRENT trainable model (not the fixed embedder) over
        images and return per-image anomaly scores, used for both real
        evaluation and for scoring the golden reference set each round.

        Used by: rollback-service's drift monitor, evaluation harness.
        """
        raise NotImplementedError

    # --- optional metadata, has a sane default, no need to override ---
    def model_id(self) -> str:
        return self.__class__.__name__
