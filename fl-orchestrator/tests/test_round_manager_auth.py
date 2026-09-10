from shared.mock_model.mock_adapter import (
    MockModelAdapter,
    make_golden_reference,
)

from client_sim.simulated_client import SimulatedClient
from golden_reference.reference_stats import compute_reference_stats
from server.round_manager import authenticate_round


class AlwaysPoisonedAdapter(MockModelAdapter):
    """Adapter whose embeddings are always poisoned (the attacker)."""

    def embed(self, images=None, n: int = 16, poisoned: bool = False):
        return super().embed(images, n=n, poisoned=True)


def test_authenticate_round_excludes_poisoned():
    reference_stats = compute_reference_stats(make_golden_reference())

    clients = [
        SimulatedClient(MockModelAdapter(f"honest-{i}", seed=42 + i), f"honest-{i}")
        for i in range(4)
    ]
    attacker = SimulatedClient(
        AlwaysPoisonedAdapter("attacker", seed=999), "attacker"
    )
    clients.append(attacker)

    passing, all_scores = authenticate_round(clients, 1, reference_stats)

    total = len(clients)
    assert len(all_scores) == total
    assert {s.client_did for s in all_scores} == {c.client_did for c in clients}
    assert "attacker" not in {c.client_did for c in passing}
    # Gating invariant: passing <=> score.passed, on both lists.
    by_did = {s.client_did: s for s in all_scores}
    assert all(by_did[c.client_did].passed for c in passing)
    assert all(
        not by_did[c.client_did].passed
        for c in clients
        if c.client_did not in {p.client_did for p in passing}
    )

    poisoned_excluded = "attacker" not in {c.client_did for c in passing}
    print(
        f"[C3] total_clients={total} passed_clients={len(passing)} "
        f"poisoned_excluded={poisoned_excluded}"
    )
