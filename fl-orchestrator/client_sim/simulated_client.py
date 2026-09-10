"""Simulated federated client wrapping a ModelAdapter."""

import numpy as np
from shared.interfaces.model_adapter import ModelAdapter


class SimulatedClient:
    def __init__(self, adapter: ModelAdapter, client_did: str):
        self.adapter = adapter
        self.client_did = client_did

    @property
    def model_adapter(self) -> ModelAdapter:
        """Alias for ``adapter`` (the name the round manager uses)."""
        return self.adapter

    def run_round(
        self, inject_drift: bool = False
    ) -> dict[str, np.ndarray]:
        """Run one local training round; return the updated weights."""
        return self.adapter.local_train(inject_drift=inject_drift)
