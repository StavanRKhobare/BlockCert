"""Sliding-window drift monitor for the rollback-service.

A stateful ``DriftMonitor`` persists for the whole simulation (never recreated
per round). It watches the trend of mean suspicion and reference-set accuracy
over a rolling window and emits a ``DriftEvent`` when suspicion stays high
while accuracy declines — even if no single round crossed auth-service's
per-round bar.
"""

from shared.interfaces.schemas import DriftEvent, SuspicionScore


class DriftMonitor:
    def __init__(self, window_size: int = 5, drift_threshold: float = 2.0):
        self.window_size = window_size
        self.drift_threshold = drift_threshold
        self._mean_scores: list[float] = []
        self._accuracies: list[float] = []

    def ingest_round(
        self,
        round_number: int,
        suspicion_scores: list[SuspicionScore],
        reference_set_accuracy: float,
        latest_checkpoint_hash: str,
    ) -> DriftEvent | None:
        """Ingest one round and return a ``DriftEvent`` if drift triggers.

        NOTE ON ``latest_checkpoint_hash``: the caller is responsible for
        passing the hash of the last checkpoint BEFORE this window started.
        Passing a newer hash silently breaks the whole rollback guarantee —
        the executor would "revert" to weights that already contain the drift.
        """
        mean_score = sum(s.combined_score for s in suspicion_scores) / len(
            suspicion_scores
        )
        self._mean_scores.append(mean_score)
        self._accuracies.append(reference_set_accuracy)
        if len(self._mean_scores) > self.window_size:
            self._mean_scores.pop(0)
        if len(self._accuracies) > self.window_size:
            self._accuracies.pop(0)

        if (
            len(self._mean_scores) < self.window_size
            or len(self._accuracies) < self.window_size
        ):
            return None

        avg_score = sum(self._mean_scores) / len(self._mean_scores)
        accuracy_trend = self._accuracies[-1] - self._accuracies[0]
        if avg_score > self.drift_threshold and accuracy_trend < 0:
            return DriftEvent(
                window_start_round=round_number - self.window_size + 1,
                window_end_round=round_number,
                trigger_reason=(
                    "sustained suspicion + accuracy decline over window"
                ),
                reverted_to_checkpoint_hash=latest_checkpoint_hash,
            )
        return None
