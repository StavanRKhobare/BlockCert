import inspect

from shared.mock_model.mock_adapter import (
    MockModelAdapter,
    make_golden_reference,
)

import server.round_manager as round_manager
from client_sim.simulated_client import SimulatedClient
from golden_reference.reference_stats import compute_reference_stats
from scoring.calibration import calibrate_threshold
from server.round_manager import run_round


def test_three_honest_rounds_full_loop_no_drift():
    # Touchpoint reality flags: all three are the REAL cross-service imports.
    checkpoint_round_real = (
        inspect.getmodule(round_manager.checkpoint_round).__name__
        == "checkpoint_store.hasher"
    )
    ingest_round_real = (
        type(round_manager._default_monitor).__module__
        == "drift_monitor.window_tracker"
    )
    execute_real = (
        inspect.getmodule(round_manager.execute).__name__
        == "drift_monitor.rollback_executor"
    )
    assert checkpoint_round_real is True
    assert ingest_round_real is True
    assert execute_real is True

    # Calibrate (B4.5 production flow) so honest fleet clients genuinely pass
    # and the full loop — aggregate, checkpoint, monitor — really executes.
    reference_stats = compute_reference_stats(make_golden_reference())
    reference_stats["calibrated_threshold"] = calibrate_threshold(
        reference_stats,
        [MockModelAdapter(f"calib-{i}", seed=100 + i) for i in range(5)],
    )
    clients = [
        SimulatedClient(MockModelAdapter(f"client-{i}", seed=i), f"client-{i}")
        for i in range(4)
    ]
    global_model = MockModelAdapter("global", seed=0)
    registry: dict[str, str] = {}

    errors = 0
    rounds_run = 0
    for round_number in (1, 2, 3):
        try:
            summary = run_round(
                clients,
                round_number,
                reference_stats,
                global_model,
                checkpoint_registry=registry,
            )
        except Exception:
            errors += 1
            continue
        rounds_run += 1
        assert summary["round"] == round_number
        assert summary["n_passed"] == 4
        assert summary["n_failed"] == 0
        assert summary["drift_triggered"] is False

    assert rounds_run == 3
    assert errors == 0
    # Three checkpoints chained: registry holds all three hashes.
    assert len(registry) == 3
    latest = round_manager._previous_checkpoint
    assert latest.round_number == 3
    assert latest.weights_hash in registry

    print(
        f"[C4] rounds_run={rounds_run} errors={errors} "
        f"checkpoint_round_real={checkpoint_round_real} "
        f"ingest_round_real={ingest_round_real} "
        f"execute_real={execute_real}"
    )
