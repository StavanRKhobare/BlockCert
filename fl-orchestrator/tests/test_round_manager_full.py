import inspect

from shared.mock_model.mock_adapter import (
    MockModelAdapter,
    make_golden_reference,
)

import server.round_manager as round_manager
from client_sim.simulated_client import SimulatedClient
from golden_reference.reference_stats import compute_reference_stats
from server.round_manager import run_round


def test_three_honest_rounds_no_errors_no_drift():
    # Touchpoint reality flags: checkpoint_round is the REAL rollback-service
    # import; ingest_round/execute are the local TODO stubs in round_manager.
    checkpoint_round_real = (
        inspect.getmodule(round_manager.checkpoint_round).__name__
        == "checkpoint_store.hasher"
    )
    ingest_round_stub = (
        inspect.getmodule(round_manager.ingest_round).__name__
        == "server.round_manager"
    )
    execute_stub = (
        inspect.getmodule(round_manager.execute).__name__
        == "server.round_manager"
    )
    assert checkpoint_round_real is True
    assert ingest_round_stub is True
    assert execute_stub is True

    reference_stats = compute_reference_stats(make_golden_reference())
    clients = [
        SimulatedClient(MockModelAdapter(f"honest-{i}", seed=42 + i), f"honest-{i}")
        for i in range(4)
    ]
    global_model = MockModelAdapter("global", seed=0)

    errors = 0
    rounds_run = 0
    for round_number in (1, 2, 3):
        try:
            summary = run_round(clients, round_number, reference_stats, global_model)
        except Exception:
            errors += 1
            continue
        rounds_run += 1
        assert summary["round"] == round_number
        assert summary["drift_triggered"] is False

    assert rounds_run == 3
    assert errors == 0

    print(
        f"[C4] rounds_run={rounds_run} errors={errors} "
        f"checkpoint_round_real={checkpoint_round_real} "
        f"ingest_round_stub={ingest_round_stub} "
        f"execute_stub={execute_stub}"
    )
