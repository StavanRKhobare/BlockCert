from shared.mock_model.mock_adapter import make_golden_reference

import server.round_manager as round_manager
from client_sim.partition import make_clients
from client_sim.simulated_client import SimulatedClient
from drift_monitor.window_tracker import DriftMonitor
from golden_reference.reference_stats import compute_reference_stats
from scoring.calibration import calibrate_threshold
from server.round_manager import run_round
from shared.mock_model.mock_adapter import MockModelAdapter


def test_twenty_rounds_attacker_from_round_12():
    # Fresh cross-round state (C4's test ran rounds through this same module).
    round_manager._previous_checkpoint = None
    round_manager._default_monitor = DriftMonitor()

    # Calibrate (B4.5 production flow) so honest clients genuinely pass and
    # only the attacker gets excluded once armed.
    reference_stats = compute_reference_stats(make_golden_reference())
    reference_stats["calibrated_threshold"] = calibrate_threshold(
        reference_stats,
        [MockModelAdapter(f"calib-{i}", seed=100 + i) for i in range(5)],
    )

    adapters = make_clients(8)
    clients = [
        SimulatedClient(adapter, adapter.client_did) for adapter in adapters
    ]
    global_model = MockModelAdapter("global", seed=0)
    registry: dict[str, str] = {}

    # Arm client-3 from round 12 onward: poisoned embeddings + drifted
    # training. Flag-driven patching, no production changes.
    armed = {"on": False}
    victim_adapter = adapters[3]
    orig_embed = victim_adapter.embed
    victim_adapter.embed = lambda images=None, n=16, poisoned=False: orig_embed(
        images, n=n, poisoned=(poisoned or armed["on"])
    )
    victim_client = clients[3]
    orig_run_round = victim_client.run_round
    victim_client.run_round = lambda inject_drift=False: orig_run_round(
        inject_drift=armed["on"]
    )

    summaries = []
    for round_number in range(1, 21):
        if round_number == 12:
            armed["on"] = True
        summary = run_round(
            clients,
            round_number,
            reference_stats,
            global_model,
            checkpoint_registry=registry,
        )
        summaries.append(summary)
        print(
            f"[C5] round={summary['round']} n_passed={summary['n_passed']} "
            f"n_failed={summary['n_failed']} "
            f"drift_triggered={summary['drift_triggered']}"
        )

    # Rounds 1-11 are all-honest: nobody excluded.
    assert all(s["n_failed"] == 0 for s in summaries[:11])
    # From round 12 the only change is the armed attacker: it gets excluded
    # in at least one round.
    attacker_ever_excluded = any(s["n_failed"] >= 1 for s in summaries[11:])
    assert attacker_ever_excluded is True
    print(f"[C5] attacker_ever_excluded={attacker_ever_excluded}")
