from shared.interfaces.schemas import SuspicionScore

from drift_monitor.window_tracker import DriftMonitor


def _scores(combined: float, n_clients: int = 3) -> list[SuspicionScore]:
    return [
        SuspicionScore(
            client_did=f"did:example:client-{i}",
            round_number=0,
            outlier_fraction=0.0,
            mean_shift=0.0,
            micro_cluster_score=0.5,
            reference_set_accuracy_delta=0.0,
            combined_score=combined,
            passed=combined < 3.0,
        )
        for i in range(n_clients)
    ]


def test_stable_then_drifting_windows():
    monitor = DriftMonitor()

    stable_triggered = False
    for round_number in range(1, 6):
        event = monitor.ingest_round(
            round_number,
            _scores(0.5),
            0.90,
            "hash-before-window",
        )
        stable_triggered = stable_triggered or event is not None
    assert stable_triggered is False

    trigger_round = None
    drift_event = None
    accuracies = [0.82, 0.74, 0.66, 0.58, 0.50]
    for i, round_number in enumerate(range(6, 11)):
        drift_event = monitor.ingest_round(
            round_number,
            _scores(5.0),
            accuracies[i],
            "hash-before-window",
        )
        if drift_event is not None:
            trigger_round = round_number
            break

    drift_triggered = drift_event is not None
    assert drift_triggered is True
    assert drift_event.window_start_round == trigger_round - 5 + 1
    assert drift_event.window_end_round == trigger_round
    assert drift_event.reverted_to_checkpoint_hash == "hash-before-window"

    print(
        f"[D3] stable_rounds_triggered={stable_triggered} "
        f"drift_rounds_triggered={drift_triggered} "
        f"trigger_round={trigger_round}"
    )
