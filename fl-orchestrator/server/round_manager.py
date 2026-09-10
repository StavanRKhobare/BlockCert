"""Round manager for the fl-orchestrator.

Drives simulated clients through authentication-gated federated rounds.
``auth-service/`` is on ``sys.path`` (see ``tests/conftest.py``) so the real
``score_client`` entrypoint is used — never a local copy.
"""

from entrypoint import score_client
from shared.interfaces.schemas import SuspicionScore

from client_sim.simulated_client import SimulatedClient


def authenticate_round(
    clients: list[SimulatedClient],
    round_number: int,
    reference_stats: dict,
) -> tuple[list[SimulatedClient], list[SuspicionScore]]:
    """Authenticate every client for one round (touchpoint #1).

    Returns the sub-list of clients whose score passed, plus ALL suspicion
    scores (passed and failed) — the full list is needed later by the drift
    monitor (touchpoint #3).
    """
    passing: list[SimulatedClient] = []
    all_scores: list[SuspicionScore] = []
    for client in clients:
        embeddings = client.model_adapter.embed()
        score = score_client(
            client.client_did, round_number, embeddings, reference_stats
        )
        all_scores.append(score)
        if score.passed:
            passing.append(client)
    return passing, all_scores
