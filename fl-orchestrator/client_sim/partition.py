"""Non-IID client partitioning for the fl-orchestrator (mock-model stage)."""

from shared.mock_model.mock_adapter import MockModelAdapter


def make_clients(n_clients: int = 8, seed: int = 0) -> list[MockModelAdapter]:
    """Create ``n_clients`` mock adapters with distinct DIDs and seeds.

    NOTE: distinct random seeds stand in for non-IID-ness here — each seed
    gives the client a different embedding class-center. Once the real vision
    model exists, this must be replaced with an actual per-client data
    partition by defect category, not just a different random seed.
    """
    return [
        MockModelAdapter(f"client-{i}", seed=seed + i) for i in range(n_clients)
    ]
